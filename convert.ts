import { DMMF } from "@prisma/generator-helper";
import { getDMMF } from "@prisma/sdk";
import { pascalCase, snakeCase } from "change-case";
import { mkdir, writeFile } from "fs/promises";

type Schema = {
  path: string;
  source: string;
};
export interface DatamodelFieldMap {
  model: DMMF.Model;
  enums: DMMF.Field[];
  scalars: DMMF.Field[];
  relations: DMMF.Field[];
}
export interface DatamodelStructure {
  enumMap: Record<string, DMMF.Model>;
  modelMap: Record<string, DMMF.Model>;
  modelFieldMap: Record<string, DatamodelFieldMap>;
}

const PrismaTypesMap = new Map([
  ["String", "String"],
  ["Boolean", "Bool"],
  ["Int", "Int"],
  ["BigInt", "Int64"],
  ["Float", "Float"],
  ["Decimal", "Float"],
  ["DateTime", "Time"],
  ["Json", "JSON"],
  ["Bytes", "Bytes"],
]);

const slice = (l: string[]) => [...l, "\n    "].join(",");
const quotedSlice = (l: string[]) => l.map((v) => `"${v}"`).join(",");

const when = (cond: boolean, item: any) => (cond ? [item] : []);

const optional = (f: DMMF.Field) => {
  if (f.isRequired) {
    return [];
  }

  return [".Optional()"];
};

const defaultValue = (f: DMMF.Field) => {
  if (f.default === undefined) {
    return [];
  }

  switch (typeof f.default) {
    case "boolean":
      return [`.Default(${f.default})`];

    case "string":
      return [`.Default("${f.default}")`];

    case "number":
      return [`.Default(${f.default})`];

    // case "object"
    //   interface FieldDefault {
    //     name: string;
    //     args: any[];
    //   }

    //   const { name } = f.default as FieldDefault;

    default:
      return [];
  }
};

export function getModelFieldMap(model: DMMF.Model): DatamodelFieldMap {
  const fields = model.fields;
  const enums = fields.filter((f) => f.kind === "enum");
  const scalars = fields.filter((f) => f.kind === "scalar");
  const relations = fields.filter((f) => f.kind === "object");

  const relationFieldIs: any = [];
  relations.forEach((item) => {
    if (item.relationFromFields?.length) {
      relationFieldIs.push(...item.relationFromFields);
    }
  });

  return {
    model,
    enums,
    scalars: scalars.filter((scalar) => !relationFieldIs.includes(scalar.name)),
    relations,
  };
}

export function buildDatamodelStructure(
  dmmf: DMMF.Document
): DatamodelStructure {
  const enumMap = dmmf.datamodel.enums.reduce(
    (acc, curr) => ({ ...acc, [curr.name]: curr }),
    {}
  );
  const modelMap = dmmf.datamodel.models.reduce(
    (acc, curr) => ({ ...acc, [curr.name]: curr }),
    {}
  );
  const modelFieldMap = dmmf.datamodel.models.reduce(
    (acc, curr) => ({ ...acc, [curr.name]: getModelFieldMap(curr) }),
    {}
  );

  return {
    enumMap,
    modelMap,
    modelFieldMap,
  };
}

const getFieldValue = (f: DMMF.Field, d: DatamodelFieldMap): string => {
  const t = f.type;
  switch (t) {
    case "Json": {
      return "[]string{}";
    }
    default: {
      return "";
    }
  }
};

interface Field {
  Type: string;
  Name: string;
  Value: string;
  Suffix: string;
}

const getField = (f: DMMF.Field, d: DatamodelFieldMap): Field | undefined => {
  const type = PrismaTypesMap.get(f.type);
  if (type === undefined) {
    return undefined;
  }

  if (f.relationToFields) {
    return undefined;
  }

  const values = getFieldValue(f, d);
  return {
    Type: type,
    Name: `"${f.name}"`,
    Value: values ? ", " + values : "",
    Suffix: getSuffixes(f) || "",
  };
};

const getSuffixes = (f: DMMF.Field) =>
  [
    // .Optional()
    ...optional(f),
    // .Default(value...)
    ...defaultValue(f),
  ].join("");

const enumToGo = (f: DMMF.Field, structure: DatamodelStructure): string => {
  const suffixes = getSuffixes(f);
  const values = structure.enumMap[f.type].values.map((v: any) => v.name);
  return `
        field.Enum("${f.name}").Values(${quotedSlice(values)})${suffixes}`;
};

const fieldToGo = (
  f: DMMF.Field,
  data: DatamodelFieldMap,
  structure: DatamodelStructure
): string | undefined => {
  if (f.kind === "enum") {
    return enumToGo(f, structure);
  }

  const field = getField(f, data);
  if (field === undefined) {
    return undefined;
  }

  return `
        field.${field.Type}(${field.Name}${field.Value})${field.Suffix}`;
};

const edgeToGo = (f: DMMF.Field): string => {
  //console.log(f.name, f.relationFromFields, f.relationName, f.relationToFields);
  return `
        edge.To("${f.name}", ${f.type}.Type)`;
};

const modelToGo = (
  data: DatamodelFieldMap,
  structure: DatamodelStructure
): Schema => {
  const { name, fields } = data.model;
  const path = `./ent/schema/${snakeCase(name)}.go`;

  const edges = fields.filter((v) => v.relationToFields !== undefined);
  const edgeList = edges.map(edgeToGo);

  const fieldList: string[] = fields
    .map((f) => fieldToGo(f, data, structure))
    .filter((v) => v !== undefined) as string[];

  // TODO: generate a list of relationships

  const fieldsString = `[]ent.Field{${slice(fieldList)}}`;
  const edgesString = `[]ent.Edge{${slice(edgeList)}}`;

  let edgeImport = "";
  if (edgeList.length) {
    edgeImport = `\n\t"entgo.io/ent/schema/edge"`;
  }

  const source = `
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field" ${edgeImport}
)

// ${name} holds the schema definition for the ${name} entity.
type ${name} struct {
    ent.Schema
}

// Fields of ${name}.
func (${name}) Fields() []ent.Field {
    return ${fieldsString}
}

// Edges of ${name}.
func (${name}) Edges() []ent.Edge {
    return ${edgesString}
}
`;

  return {
    source,
    path,
  };
};

const save = async (s: Schema) => {
  await mkdir("./ent/schema/", { recursive: true });
  await writeFile(s.path, s.source);
};

(async () => {
  const dmmf = await getDMMF({ datamodelPath: "prisma/schema.prisma" });
  const structure: DatamodelStructure = buildDatamodelStructure(dmmf);

  const models = dmmf.datamodel.models.map((model) =>
    modelToGo(structure.modelFieldMap[model.name], structure)
  );

  // TODO: Invoke `go generate`

  await Promise.all(models.map(save));

  console.log("Done!");
})();

import { DMMF } from "@prisma/generator-helper";
import { getDMMF } from "@prisma/sdk";
import { pascalCase, snakeCase } from "change-case";
import { fstat } from "fs";
import { mkdir, writeFile } from "fs/promises";

type Schema = {
  path: string;
  source: string;
};

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

const getFieldType = (f: DMMF.Field) => {
  const t = f.type;
  switch (t) {
    case "Boolean":
      return "Bool";
    case "DateTime":
      return "Time";

    default:
      return pascalCase(t);
  }
};

const getSuffixes = (f: DMMF.Field) =>
  [
    // .Optional()
    ...optional(f),
    // .Default(value...)
    ...defaultValue(f),
  ].join("");

const enumToGo = (f: DMMF.Field, d: DMMF.Document): string => {
  const suffixes = getSuffixes(f);

  const enumData = d.datamodel.enums
    .filter((e) => e.name == f.type)
    .map((e) => e.values);
  const enumValues = enumData[0].map((e) => e.name);

  return `
        field.Enum("${f.name}").Values(${quotedSlice(enumValues)})${suffixes}`;
};

const fieldToGo = (f: DMMF.Field, d: DMMF.Document): string | undefined => {
  if (f.kind === "enum") {
    return enumToGo(f, d);
  }

  const fieldType = getFieldType(f);

  const suffixes = getSuffixes(f);

  if (f.relationToFields) {
    return undefined;
  }

  return `
        field.${fieldType}("${f.name}")${suffixes}`;
};

const edgeToGo = (f: DMMF.Field): string => {
  //console.log(f.name, f.relationFromFields, f.relationName, f.relationToFields);
  return `
    edge.To("${f.name}", ${f.type}.Type)`;
};

const modelToGo = (model: DMMF.Model, document: DMMF.Document): Schema => {
  const { name, fields } = model;

  const path = `./ent/schema/${snakeCase(name)}.go`;

  const edges = fields.filter((v) => v.relationToFields !== undefined);

  const edgeList = edges.map(edgeToGo);

  const fieldList: string[] = fields
    .map((f) => fieldToGo(f, document))
    .filter((v) => v !== undefined) as string[];

  // TODO: generate a list of relationships

  const fieldsString = `[]ent.Field{${slice(fieldList)}}`;
  const edgesString = `[]ent.Edge{${slice(edgeList)}}`;

  const source = `
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/edge"
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

  const models = dmmf.datamodel.models.map((model) => modelToGo(model, dmmf));

  // TODO: Invoke `go generate`

  await Promise.all(models.map(save));

  console.log("Done!");
})();

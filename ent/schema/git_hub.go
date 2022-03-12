
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/edge"
)

// GitHub holds the schema definition for the GitHub entity.
type GitHub struct {
    ent.Schema
}

// Fields of GitHub.
func (GitHub) Fields() []ent.Field {
    return []ent.Field{
        field.String("userId"),
        field.String("accountId"),
        field.String("username"),
        field.String("email"),
    }
}

// Edges of GitHub.
func (GitHub) Edges() []ent.Edge {
    return []ent.Edge{
    edge.To("user", User.Type),
    }
}

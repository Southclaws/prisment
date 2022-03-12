
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/edge"
)

// Discord holds the schema definition for the Discord entity.
type Discord struct {
    ent.Schema
}

// Fields of Discord.
func (Discord) Fields() []ent.Field {
    return []ent.Field{
        field.String("userId"),
        field.String("accountId"),
        field.String("username"),
        field.String("email"),
    }
}

// Edges of Discord.
func (Discord) Edges() []ent.Edge {
    return []ent.Edge{
    edge.To("user", User.Type),
    }
}

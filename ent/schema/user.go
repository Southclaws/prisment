
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/edge"
)

// User holds the schema definition for the User entity.
type User struct {
    ent.Schema
}

// Fields of User.
func (User) Fields() []ent.Field {
    return []ent.Field{
        field.String("id"),
        field.String("email"),
        field.Enum("TODO: Enums"),
        field.String("name"),
        field.String("bio").Optional(),
        field.Bool("admin").Default(false),
        field.Time("createdAt"),
        field.Time("updatedAt"),
        field.Time("deletedAt").Optional(),
    }
}

// Edges of User.
func (User) Edges() []ent.Edge {
    return []ent.Edge{
    edge.To("github", GitHub.Type),
    edge.To("discord", Discord.Type),
    edge.To("servers", Server.Type),
    edge.To("posts", Post.Type),
    edge.To("reacts", React.Type),
    edge.To("subscriptions", Subscription.Type),
    }
}

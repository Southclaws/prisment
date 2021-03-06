
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/edge"
)

// Subscription holds the schema definition for the Subscription entity.
type Subscription struct {
    ent.Schema
}

// Fields of Subscription.
func (Subscription) Fields() []ent.Field {
    return []ent.Field{
        field.String("id"),
        field.Enum("TODO: Enums"),
        field.String("refersTo"),
        field.Time("createdAt"),
        field.Time("updatedAt"),
        field.Time("deletedAt").Optional(),
        field.String("userId"),
    }
}

// Edges of Subscription.
func (Subscription) Edges() []ent.Edge {
    return []ent.Edge{
    edge.To("user", User.Type),
    edge.To("notifications", Notification.Type),
    }
}

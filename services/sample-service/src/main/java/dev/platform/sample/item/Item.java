package dev.platform.sample.item;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "items")
class Item {
    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Item() {
    }

    Item(UUID id, String name, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.createdAt = createdAt;
    }

    UUID getId() {
        return id;
    }

    String getName() {
        return name;
    }

    Instant getCreatedAt() {
        return createdAt;
    }
}

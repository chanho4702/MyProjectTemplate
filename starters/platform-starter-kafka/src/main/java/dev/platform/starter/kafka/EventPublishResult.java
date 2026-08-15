package dev.platform.starter.kafka;

public record EventPublishResult(String topic, int partition, long offset) {
}

package dev.platform.starter.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.kafka.core.KafkaOperations;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

final class KafkaEventPublisher implements EventPublisher {
    private final KafkaOperations<String, String> kafka;
    private final ObjectMapper objectMapper;

    KafkaEventPublisher(KafkaOperations<String, String> kafka, ObjectMapper objectMapper) {
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    @Override
    public CompletionStage<EventPublishResult> publish(String topic, String key, DomainEvent<?> event) {
        String json;
        try {
            json = objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException exception) {
            return CompletableFuture.failedFuture(exception);
        }
        return kafka.send(topic, key, json).thenApply(result -> new EventPublishResult(
                result.getRecordMetadata().topic(),
                result.getRecordMetadata().partition(),
                result.getRecordMetadata().offset()
        ));
    }
}

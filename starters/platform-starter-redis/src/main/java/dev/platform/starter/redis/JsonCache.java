package dev.platform.starter.redis;

import java.time.Duration;
import java.util.Optional;

public interface JsonCache {
    <T> void put(String namespace, String key, T value, Duration ttl);

    <T> Optional<T> get(String namespace, String key, Class<T> type);

    void evict(String namespace, String key);
}

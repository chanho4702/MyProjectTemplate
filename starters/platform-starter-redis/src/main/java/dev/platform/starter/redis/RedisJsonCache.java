package dev.platform.starter.redis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.Optional;
import java.util.regex.Pattern;

final class RedisJsonCache implements JsonCache {
    private static final Pattern SAFE_KEY_PART = Pattern.compile("[A-Za-z0-9._-]{1,160}");

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final String keyPrefix;

    RedisJsonCache(StringRedisTemplate redis, ObjectMapper objectMapper, String keyPrefix) {
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.keyPrefix = requireSafe("keyPrefix", keyPrefix);
    }

    @Override
    public <T> void put(String namespace, String key, T value, Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("ttl must be positive");
        }
        try {
            redis.opsForValue().set(redisKey(namespace, key), objectMapper.writeValueAsString(value), ttl);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("value cannot be serialized as JSON", exception);
        }
    }

    @Override
    public <T> Optional<T> get(String namespace, String key, Class<T> type) {
        String value = redis.opsForValue().get(redisKey(namespace, key));
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(value, type));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("cached JSON cannot be read as " + type.getName(), exception);
        }
    }

    @Override
    public void evict(String namespace, String key) {
        redis.delete(redisKey(namespace, key));
    }

    private String redisKey(String namespace, String key) {
        return keyPrefix + ':' + requireSafe("namespace", namespace) + ':' + requireSafe("key", key);
    }

    private static String requireSafe(String label, String value) {
        if (value == null || !SAFE_KEY_PART.matcher(value).matches()) {
            throw new IllegalArgumentException(label + " must match " + SAFE_KEY_PART.pattern());
        }
        return value;
    }
}

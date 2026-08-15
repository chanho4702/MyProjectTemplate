package dev.platform.starter.redis;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.redis")
public class PlatformRedisProperties {
    private boolean enabled;
    private String keyPrefix = "platform";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public void setKeyPrefix(String keyPrefix) {
        this.keyPrefix = keyPrefix;
    }
}

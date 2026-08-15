package dev.platform.starter.kafka;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.kafka")
public class PlatformKafkaProperties {
    private boolean enabled;
    private String source = "application";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}

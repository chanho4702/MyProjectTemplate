package dev.platform.starter.search;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.search")
public class PlatformSearchProperties {
    private boolean enabled;
    private String indexPrefix = "platform";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getIndexPrefix() {
        return indexPrefix;
    }

    public void setIndexPrefix(String indexPrefix) {
        this.indexPrefix = indexPrefix;
    }
}

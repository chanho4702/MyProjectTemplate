package dev.platform.starter.data;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.datasource")
public class PlatformDataSourceProperties {
    private boolean enabled;
    private final Endpoint writer = new Endpoint();
    private final Endpoint reader = new Endpoint();
    private final Pool pool = new Pool();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Endpoint getWriter() {
        return writer;
    }

    public Endpoint getReader() {
        return reader;
    }

    public Pool getPool() {
        return pool;
    }

    public static class Endpoint {
        private String url;
        private String username;
        private String password;

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        boolean configured() {
            return url != null && !url.isBlank();
        }
    }

    public static class Pool {
        private int maximumSize = 10;
        private int minimumIdle = 1;
        private long connectionTimeoutMs = 3000;

        public int getMaximumSize() {
            return maximumSize;
        }

        public void setMaximumSize(int maximumSize) {
            this.maximumSize = maximumSize;
        }

        public int getMinimumIdle() {
            return minimumIdle;
        }

        public void setMinimumIdle(int minimumIdle) {
            this.minimumIdle = minimumIdle;
        }

        public long getConnectionTimeoutMs() {
            return connectionTimeoutMs;
        }

        public void setConnectionTimeoutMs(long connectionTimeoutMs) {
            this.connectionTimeoutMs = connectionTimeoutMs;
        }
    }
}

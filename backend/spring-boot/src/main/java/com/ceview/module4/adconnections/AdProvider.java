package com.ceview.module4.adconnections;

/**
 * The two ad platforms CeView can pull campaign metrics from.
 *
 * <p>{@link #key()} is the lowercase string used in URL paths, the
 * {@code provider} column, and the frontend's {@code AdProvider} union type —
 * it must stay in sync with the {@code chk_ad_conn_provider} CHECK constraint
 * in V27.
 *
 * <p>Meta covers Facebook <em>and</em> Instagram ad placements: one ad account
 * runs both, and the insights call breaks them down by {@code publisher_platform}.
 * That is why there is no separate Instagram provider here.
 */
public enum AdProvider {

    META("meta"),
    TIKTOK("tiktok");

    private final String key;

    AdProvider(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    /** @throws IllegalArgumentException for any key that is not a known provider */
    public static AdProvider fromKey(String key) {
        for (AdProvider p : values()) {
            if (p.key.equalsIgnoreCase(key)) return p;
        }
        throw new IllegalArgumentException("unknown ad provider: " + key);
    }
}

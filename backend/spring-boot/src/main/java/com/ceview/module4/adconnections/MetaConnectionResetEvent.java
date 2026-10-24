package com.ceview.module4.adconnections;

import java.util.UUID;

/**
 * Published (synchronously, inside the publisher's transaction) when a profile's Meta login is
 * replaced or disconnected. Anything derived from the old login — notably the Facebook Page /
 * Instagram publishing tokens in Module 3 — must be discarded.
 */
public record MetaConnectionResetEvent(UUID businessProfileId) {}

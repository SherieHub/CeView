package com.ceview.module3.social.publish.client;

/** Resume the persisted container later without counting normal processing as a failed attempt. */
public class ProcessingPendingException extends DeliveryException {
    public ProcessingPendingException() { super("The platform is processing the media.", false, true); }
}

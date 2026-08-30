package com.ceview.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Renders {@link AiDependencyException} as the unavailability contract body. */
@RestControllerAdvice
public class AiDependencyExceptionHandler {

    @ExceptionHandler(AiDependencyException.class)
    public ResponseEntity<Map<String, Object>> handle(AiDependencyException ex) {
        return ResponseEntity.status(ex.getStatus()).body(ex.toBody());
    }
}

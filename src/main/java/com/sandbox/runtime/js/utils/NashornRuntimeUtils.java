package com.sandbox.runtime.js.utils;

import com.sandbox.runtime.js.converters.NashornConverter;
import com.sandbox.runtime.models.Cache;
import jdk.nashorn.internal.runtime.ScriptObject;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Created by drew on 4/08/2014.
 */
public class NashornRuntimeUtils extends NashornUtils {

    @Autowired
    private Cache cache;

    private final String fullSandboxId;

    public NashornRuntimeUtils(String fullSandboxId) {
        this.fullSandboxId = fullSandboxId;
    }

    public String getFullSandboxId() {
        return fullSandboxId;
    }

    public String readFile(String filename) {
        return cache.getRepositoryFile(getFullSandboxId(), filename);
    }

    @Override
    public ScriptObject listFiles() {
        try {
            return (ScriptObject) NashornConverter.instance().convert(cache.getRepositoryFileList(fullSandboxId, "head"));
        } catch (Exception e) {
            logger.error("Error listing files", e);
            return null;
        }
    }

}

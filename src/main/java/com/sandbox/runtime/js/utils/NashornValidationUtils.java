package com.sandbox.runtime.js.utils;

import com.sandbox.runtime.js.converters.NashornConverter;
import jdk.nashorn.internal.runtime.ScriptObject;

import java.util.Map;

/**
 * Created by drew on 4/08/2014.
 */
public class NashornValidationUtils extends NashornUtils {

    private Map<String, String> fileCache;

    public NashornValidationUtils() {
        super();
    }

    @Override
    public String readFile(String filename) {

        String fileContents = fileCache.get(filename);

        if (fileContents == null) {
            // TODO: do something
            return null;
        }

        return fileContents;
    }

    @Override
    public ScriptObject listFiles() {
        try {
            return (ScriptObject) NashornConverter.instance().convert(fileCache.keySet());
        } catch (Exception e) {
            logger.error("Error listing files", e);
            return null;
        }
    }

    public void setFileCache(Map<String, String> fileCache) {
        this.fileCache = fileCache;
    }
}


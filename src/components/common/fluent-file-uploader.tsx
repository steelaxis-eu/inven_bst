"use client";

import { useState } from "react";
import { Button, Spinner, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowUploadRegular, CheckmarkCircleRegular, DocumentRegular } from "@fluentui/react-icons";
import { supabase } from "@/lib/supabase";

const useStyles = makeStyles({
    container: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    input: {
        display: "none",
    },
    fileInfo: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        color: tokens.colorPaletteGreenForeground1,
        fontSize: "12px",
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: "12px",
    }
});

interface FluentFileUploaderProps {
    bucketName: string;
    onUploadComplete: (url: string) => void;
    currentValue?: string;
    minimal?: boolean;
    folderPath?: string;
    accept?: string;
    label?: string;
}

export function FluentFileUploader({ bucketName, onUploadComplete, currentValue, minimal, folderPath, accept, label }: FluentFileUploaderProps) {
    const styles = useStyles();
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(
        currentValue ? currentValue.split("/").pop() || "File" : null
    );
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            setError(null);
            if (!event.target.files || event.target.files.length === 0) {
                return;
            }
            const file = event.target.files[0];
            const fileExt = file.name.split(".").pop();
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");

            // Use folderPath if provided, otherwise default to year/month
            const dir = folderPath ? folderPath : `${year}/${month}`;
            const filePath = `${dir}/${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            setFileName(file.name);
            onUploadComplete(filePath);
        } catch (error) {
            console.error(error);
            setError("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const inputId = `file-upload-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={styles.container}>
            <label htmlFor={inputId}>
                <Button
                    icon={uploading ? <Spinner size="tiny" /> : <ArrowUploadRegular />}
                    size="small"
                    disabled={uploading}
                    style={{ cursor: "pointer" }}
                    onClick={() => document.getElementById(inputId)?.click()}
                >
                    {label || (minimal ? "Upload" : uploading ? "Uploading..." : "Upload Cert")}
                </Button>
            </label>
            <input
                id={inputId}
                type="file"
                className={styles.input}
                onChange={handleUpload}
                disabled={uploading}
                accept={accept}
            />

            {currentValue && !uploading && (
                <div className={styles.fileInfo} title={fileName || ""}>
                    <CheckmarkCircleRegular />
                    <Text wrap={false} style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fileName || "Attached"}
                    </Text>
                </div>
            )}

            {error && <span className={styles.error}>{error}</span>}
        </div>
    );
}

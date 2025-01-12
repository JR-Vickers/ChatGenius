'use client';

import { useState, useRef } from 'react';
import { createSupabaseClient } from '@/utils/supabase';
import { useQueryClient } from '@tanstack/react-query';

const supabase = createSupabaseClient();

interface FileUploadProps {
  channelId: string;
  onUploadComplete: (fileMetadata: { id: string; name: string; type: string; size: number; path: string }) => void;
}

export default function FileUpload({ channelId, onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      const ALLOWED_TYPES = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'text/plain',
        // Add more as needed
      ];

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`File ${file.name} is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
          continue;
        }
        
        if (!ALLOWED_TYPES.includes(file.type)) {
          setError(`File type ${file.type} not allowed`);
          continue;
        }

        // Generate a unique file path
        const filePath = `${channelId}/${Date.now()}-${file.name}`;

        // Upload to storage
        const { error: storageError } = await supabase.storage
          .from('files')
          .upload(filePath, file);

        if (storageError) throw storageError;

        // Create file metadata
        const { data: fileData, error: fileError } = await supabase
          .from('files')
          .insert([{
            name: file.name,
            size: file.size,
            type: file.type,
            path: filePath,
            channel_id: channelId,
            user_id: user.id
          }])
          .select()
          .single();

        if (fileError) throw fileError;

        onUploadComplete(fileData);
      }

      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded p-4 ${
        isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300'
      } ${isUploading ? 'opacity-50' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleUpload(e.dataTransfer.files);
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={(e) => handleUpload(e.target.files)}
      />
      <div className="text-center text-gray-500">
        {isUploading ? (
          <>
            Uploading...
            <br />
            <span className="text-sm">(50MB max)</span>
            {isUploading && (
              <div className="bg-gray-800 h-1 w-full">
                <div 
                  className="bg-green-500 h-full transition-all" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            Drop files here or click to upload
            <br />
            <span className="text-sm">(50MB max)</span>
          </>
        )}
      </div>
      {error && (
        <div className="text-red-500 text-sm mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
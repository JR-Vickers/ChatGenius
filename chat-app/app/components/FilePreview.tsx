'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase';

const supabase = createSupabaseClient();

interface FilePreviewProps {
  file: {
    name: string;
    type: string;
    path: string;
    size: number;
  };
}

export default function FilePreview({ file }: FilePreviewProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('files')
        .download(file.path);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloading(false);
    }
  };

  const isImage = file.type.startsWith('image/');
  const fileSize = (file.size / 1024 / 1024).toFixed(2); // Convert to MB

  return (
    <div className="border rounded p-2 my-2 bg-gray-800">
      {isImage ? (
        <div className="space-y-2">
          <img
            src={supabase.storage.from('files').getPublicUrl(file.path).data.publicUrl}
            alt={file.name}
            className="max-w-sm max-h-48 object-contain"
          />
          <div className="text-sm text-gray-400">
            {file.name} ({fileSize} MB)
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="text-2xl">📄</span>
          <div className="flex-1">
            <div className="text-green-500">{file.name}</div>
            <div className="text-sm text-gray-400">{fileSize} MB</div>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="text-green-500 hover:text-green-400"
          >
            {downloading ? '[⏳]' : '[⬇️]'}
          </button>
        </div>
      )}
    </div>
  );
}
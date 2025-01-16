'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/utils/supabase';

interface ProfilePictureUploadProps {
  userId: string;
  existingUrl?: string;
  onUploadComplete?: (url: string) => void;
}

export default function ProfilePictureUpload({ 
  userId, 
  existingUrl,
  onUploadComplete 
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseClient();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      setUploading(true);

      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/profile-picture.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onUploadComplete?.(publicUrl);
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        {existingUrl ? (
          <img 
            src={existingUrl} 
            alt="Profile" 
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-[#1164A3] flex items-center justify-center text-white text-2xl">
            ?
          </div>
        )}
        <label 
          className="absolute bottom-0 right-0 w-8 h-8 bg-[#1164A3] rounded-full cursor-pointer flex items-center justify-center hover:bg-[#0D4F8C] transition-colors"
          htmlFor="profile-picture-upload"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="text-white"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </label>
      </div>
      
      <input
        id="profile-picture-upload"
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
      />
      
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
      
      {uploading && (
        <p className="text-sm text-[#ABABAD]">Uploading...</p>
      )}
    </div>
  );
} 
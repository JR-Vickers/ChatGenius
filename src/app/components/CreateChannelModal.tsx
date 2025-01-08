'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSubmit: (channelName: string) => Promise<void>;
}

const CreateChannelModal = ({ onClose, onSubmit }: Props) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-black border border-green-800/50 p-4 w-80">
        <h2 className="text-green-500 mb-4">[New Channel]</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black border border-green-800/50 p-2 text-gray-200 mb-4"
            placeholder="Channel name..."
          />
          {error && <div className="text-red-500 mb-4">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-green-500 hover:text-green-400"
            >
              [Cancel]
            </button>
            <button
              type="submit"
              className="text-green-500 hover:text-green-400"
            >
              [Create]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal; 
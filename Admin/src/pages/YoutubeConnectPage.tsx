import { Play } from 'lucide-react';
import { useAppSelector } from '@/hooks/redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { AUTH_BASE_URL } from '@/services/api/apiConfig';

export function YoutubeConnectPage() {
  const user = useAppSelector(selectCurrentUser);
  const userId = user?.id || '';

  const handleConnect = () => {
    window.location.href = `${AUTH_BASE_URL}/auth/youtube?userId=${userId}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6">YouTube Integration</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Connect your YouTube channel to manage videos and schedule uploads.
      </p>
      
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#cc0000] text-white font-semibold py-3 px-6 rounded-md transition-colors shadow-md"
      >
        <Play size={24} />
        Connect YouTube
      </button>
    </div>
  );
}

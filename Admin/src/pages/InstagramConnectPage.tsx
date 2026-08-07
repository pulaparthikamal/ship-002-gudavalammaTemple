import { Camera } from 'lucide-react';
import { useAppSelector } from '@/hooks/redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { AUTH_BASE_URL } from '@/services/api/apiConfig';

export function InstagramConnectPage() {
  const user = useAppSelector(selectCurrentUser);

  const handleConnect = () => {
    const userId = user?.id || '';
    window.location.href = `${AUTH_BASE_URL}/auth/instagram?userId=${userId}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6">Instagram Integration</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Connect your Instagram Professional account to manage posts and reels.
      </p>
      
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] hover:opacity-90 text-white font-semibold py-3 px-6 rounded-md transition-colors shadow-md"
      >
        <Camera size={24} />
        Connect Instagram
      </button>
    </div>
  );
}

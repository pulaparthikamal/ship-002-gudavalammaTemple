import { Briefcase } from 'lucide-react';
import { useAppSelector } from '@/hooks/redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { AUTH_BASE_URL } from '@/services/api/apiConfig';

export function LinkedinConnectPage() {
  const user = useAppSelector(selectCurrentUser);
  const userId = user?.id || '';

  const handleConnect = () => {
    window.location.href = `${AUTH_BASE_URL}/auth/linkedin?userId=${userId}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6">LinkedIn Integration</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Connect your LinkedIn profile or company page to share updates and articles.
      </p>
      
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 bg-[#0077B5] hover:bg-[#006097] text-white font-semibold py-3 px-6 rounded-md transition-colors shadow-md"
      >
        <Briefcase size={24} />
        Connect LinkedIn
      </button>
    </div>
  );
}

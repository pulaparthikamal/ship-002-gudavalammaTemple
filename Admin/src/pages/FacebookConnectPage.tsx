import { useState, useEffect } from 'react';
import { Share2, Send, CheckCircle2 } from 'lucide-react';
import { useAppSelector } from '@/hooks/redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import axios from 'axios';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { Dropdown } from 'primereact/dropdown';
import { AUTH_BASE_URL } from '@/services/api/apiConfig';

export function FacebookConnectPage() {
  const user = useAppSelector(selectCurrentUser);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [message, setMessage] = useState('Hello from my new Social Media Dashboard! 🚀');
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const userId = user?.id || '';

  // Fetch stored pages on load
  useEffect(() => {
    if (userId) {
      fetchPages();
    }
  }, [userId]);

  const fetchPages = async () => {
    try {
      const response = await axios.get(`${AUTH_BASE_URL}/auth/facebook/pages?userId=${userId}`);
      if (response.data.success) {
        setPages(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedPage(response.data.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    }
  };

  const handleConnect = () => {
    window.location.href = `${AUTH_BASE_URL}/auth/facebook?userId=${userId}`;
  };

  const handlePost = async () => {
    if (!selectedPage || !message) return;
    
    setLoading(true);
    setStatus(null);
    
    try {
      const response = await axios.post(`${AUTH_BASE_URL}/auth/facebook/post`, {
        userId,
        pageId: selectedPage.pageId,
        message
      });
      
      if (response.data.message === 'Posted successfully') {
        setStatus({ type: 'success', text: 'Sample post published successfully to Facebook!' });
      }
    } catch (error: any) {
      console.error('Post failed:', error);
      setStatus({ 
        type: 'error', 
        text: `Post failed: ${error.response?.data?.error || error.message}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetActivePage = async (page: any) => {
    setLoading(true);
    setStatus(null);
    try {
      await axios.post(`${AUTH_BASE_URL}/auth/facebook/pages/active`, {
        userId,
        pageId: page.pageId
      });
      setStatus({ type: 'success', text: `"${page.pageName}" set as primary automation page!` });
    } catch (error: any) {
      console.error('Failed to set active page:', error);
      setStatus({ type: 'error', text: `Failed to set primary page: ${error.response?.data?.message || error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-[#1877F2] rounded-full flex items-center justify-center mb-4 text-white shadow-lg">
          <Share2 size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Facebook Integration</h1>
        <p className="text-gray-500 mb-8 max-w-md">
          Connect your account to fetch your pages and enable automated posting.
        </p>

        <Button
          onClick={handleConnect}
          label={pages.length > 0 ? "Reconnect Facebook" : "Connect Facebook"}
          icon={<Share2 size={20} className="mr-2" />}
          className="p-button-lg"
          style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
        />
        
        {pages.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle2 size={18} />
            Connected with {pages.length} pages
          </div>
        )}
      </div>

      {pages.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} className="text-green-500" />
              Your Pages
            </h2>
            <div className="space-y-3">
              {pages.map((page) => (
                <div key={page.pageId} className="flex items-center justify-between p-3 rounded-lg border border-gray-50 bg-gray-50/30">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{page.pageName}</span>
                    <span className="text-[10px] text-gray-400">ID: {page.pageId}</span>
                  </div>
                  <Button 
                    label="Use for Automation" 
                    icon="pi pi-link" 
                    className="p-button-text p-button-sm text-xs" 
                    onClick={() => handleSetActivePage(page)}
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Send size={20} className="text-blue-500" />
                Post a Sample
              </h2>
              <p className="text-sm text-gray-400">Test your connection by sending a post.</p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Select Page</label>
                <Dropdown
                  value={selectedPage}
                  options={pages}
                  onChange={(e) => setSelectedPage(e.value)}
                  optionLabel="pageName"
                  placeholder="Select a Page"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Message</label>
                <InputTextarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full"
                  placeholder="Enter your sample post content..."
                />
              </div>

              <Button
                label="Post to Facebook"
                icon={loading ? "pi pi-spin pi-spinner" : <Send size={18} className="mr-2" />}
                onClick={handlePost}
                disabled={loading || !message}
                className="w-full"
              />

              {status && (
                <div className="mt-4">
                  <Message 
                    severity={status.type} 
                    text={status.text} 
                    className="w-full justify-start"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-gray-300">
        Local Node Server: {AUTH_BASE_URL}/auth/facebook
      </div>
    </div>
  );
}

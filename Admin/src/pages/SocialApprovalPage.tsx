import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '@/services/api/axiosInstance';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { resolveApiAssetUrl } from '@/services/api/apiConfig';
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog';
import { formatShortFormVideoText, getShortFormVideoContent } from '@/components/social/ShortFormVideoContent';
import { CreatorResearchInformation } from '@/components/social/CreatorResearchInformation';

const joinList = (values?: unknown[]) =>
  Array.isArray(values) && values.length ? values.map((value, index) => `${index + 1}. ${String(value)}`).join('\n') : '';

const formatChapters = (chapters?: Array<{ timestamp?: string; title?: string }>) =>
  Array.isArray(chapters) && chapters.length
    ? chapters.map((chapter) => `${chapter.timestamp || '-'} ${chapter.title || 'Untitled chapter'}`).join('\n')
    : '';

const hasMarkdownSection = (text: string | undefined, section: string) => {
  if (!text?.trim()) return false;
  return new RegExp(`^\\s*#+\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(text);
};

const formatYoutubeApprovalText = (data: any) => {
  const description = typeof data.description === 'string' ? data.description : '';
  const sections = [
    ['Title', data.title, ''],
    ['Description', description, ''],
    ['Video Angle', data.video_angle, 'Video Angle'],
    ['Target Audience', data.target_audience, 'Target Audience'],
    ['Business Summary', data.business_summary, 'Business Summary'],
    ['Why Watch Now', data.why_watch_now, 'Why Watch Now'],
    ['Business Impact & Opportunities', data.business_impact_opportunities, 'Business Impact & Opportunities'],
    ['Key Talking Points', joinList(data.key_talking_points), 'Key Talking Points'],
    ['Actionable Recommendations', joinList(data.actionable_recommendations), 'Actionable Recommendations'],
    ['Proof Points Or Examples', joinList(data.proof_points_or_examples), 'Proof Points Or Examples'],
    ['Viewer Takeaways', joinList(data.viewer_takeaways), 'Viewer Takeaways'],
    ['Discussion Question', data.discussion_question, 'Discussion Question'],
    ['Chapters', formatChapters(data.chapters), 'Chapter-By-Chapter Content'],
    ['Tags', Array.isArray(data.tags) ? data.tags.join(', ') : '', ''],
    ['Thumbnail Text', data.thumbnail_text, ''],
    ['Thumbnail Concept', data.thumbnail_concept, ''],
    ['Pinned Comment', data.pinned_comment, ''],
    ['Community Post', data.community_post, ''],
    ['Shorts Ideas', joinList(data.shorts_ideas), 'Shorts Ideas'],
    ['Script', data.script, ''],
  ];

  return sections
    .filter(([, value, sectionName]) => {
      if (sectionName && hasMarkdownSection(description, String(sectionName))) return false;
      return typeof value === 'string' && value.trim();
    })
    .map(([label, value]) => `## ${label}\n${value}`)
    .join('\n\n');
};

export function SocialApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const response = await apiClient.get(`/social/posts/approval/${token}`);
        setPreview(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load approval preview. The link may be invalid or already used.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchPreview();
    }
  }, [token]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await apiClient.post(`/social/posts/approval/${token}/approve`);
      setSuccess('Post approved successfully! It will be published at the scheduled time.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await apiClient.post(`/social/posts/approval/${token}/reject`, { reason: rejectReason.trim() });
      setRejectDialogOpen(false);
      setRejectReason('');
      setSuccess('Post rejected successfully. It will not be published.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject post.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full text-center">
          <AlertCircle size={64} className="text-red-500 mb-6 mx-auto" />
          <h1 className="text-2xl font-bold mb-4 text-gray-800">Approval Error</h1>
          <p className="text-gray-600 mb-8">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full text-center">
          <CheckCircle size={64} className="text-green-500 mb-6 mx-auto" />
          <h1 className="text-2xl font-bold mb-4 text-gray-800">Success</h1>
          <p className="text-gray-600 mb-8">{success}</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (preview?.platformSpecificContent && Object.keys(preview.platformSpecificContent).length > 0) {
      return Object.entries(preview.platformSpecificContent).map(([platform, data]: [string, any]) => {
        const customVideo = getShortFormVideoContent(data)?.presentation?.replace_fallback;
        const text = platform.toLowerCase() === 'youtube' && !customVideo
          ? formatYoutubeApprovalText(data)
          : data.content || 
            (data.caption ? data.caption + (data.hashtags?.length ? '\\n\\n' + data.hashtags.join(' ') : '') : '') || 
            (data.title ? data.title + '\\n\\n' + data.description + (data.tags?.length ? '\\n\\n' + data.tags.join(' ') : '') : '');
        const shortFormVideoText = platform.toLowerCase() === 'youtube' && !customVideo
          ? ''
          : formatShortFormVideoText(getShortFormVideoContent(data));
          
        return (
          <div key={platform} className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2 capitalize">{platform} Content</h3>
            {text && (
              <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap border border-gray-200">
                {text}
              </div>
            )}
            {shortFormVideoText && (
              <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-600">
                   {getShortFormVideoContent(data)?.duration_seconds
                     ? `${getShortFormVideoContent(data)?.duration_seconds}-Second Video Script`
                     : 'Short-Form Video Script'}
                </h4>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {shortFormVideoText}
                </div>
              </div>
            )}
          </div>
        );
      });
    }

    return (
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Content</h3>
        <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap border border-gray-200">
          {preview?.content}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="bg-indigo-600 px-6 py-4">
          <h1 className="text-xl font-bold text-white">Review AI Social Media Post</h1>
        </div>
        
        <div className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Topic</h3>
              <p className="font-semibold text-gray-800">{preview?.topic || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Platforms</h3>
              <p className="font-semibold text-gray-800 capitalize">{(preview?.platforms || []).join(', ')}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Scheduled At</h3>
              <p className="font-semibold text-gray-800">{preview?.scheduledAt ? new Date(preview.scheduledAt).toLocaleString() : 'N/A'}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            {renderContent()}
          </div>

          <CreatorResearchInformation report={preview?.additionalInformation} />

          {preview?.mediaUrl && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-700 mb-4">Media</h3>
              {preview.mediaUrl.endsWith('.mp4') || preview.videoUrl ? (
                <video src={resolveApiAssetUrl(preview.videoUrl || preview.mediaUrl)} controls className="max-w-full h-auto rounded-lg border border-gray-200 max-h-[500px] object-contain bg-black w-full" />
              ) : (
                <img src={resolveApiAssetUrl(preview.mediaUrl)} alt="Post media" className="max-w-full h-auto rounded-lg border border-gray-200 max-h-[500px] object-cover" />
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-200">
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Approve Post
            </button>
            <button
              onClick={() => setRejectDialogOpen(true)}
              disabled={submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
              Reject Post
            </button>
          </div>
        </div>
      </div>
      </div>
      <ActionReasonDialog
        open={rejectDialogOpen}
        title="Reject post"
        message="Add an optional note explaining why this post should not be published."
        reason={rejectReason}
        reasonLabel="Rejection note"
        reasonPlaceholder="Optional rejection reason."
        confirmLabel="Reject Post"
        tone="danger"
        loading={submitting}
        required={false}
        onReasonChange={setRejectReason}
        onClose={() => {
          if (!submitting) setRejectDialogOpen(false)
        }}
        onConfirm={() => handleReject()}
      />
    </>
  );
}

import { useMemo } from 'react'
import React from 'react'
import { useGetSocialPostsQuery } from '@/services/api/endpoints/socialApi'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Sparkles, Clock, CheckCircle2, AlertCircle, Share2, Camera, Briefcase, Play, Send, Loader2 } from 'lucide-react'
import { cn } from '@/utils/classNames'
import { useGeneratingPosts, usePostingPosts, useEmailFailedPosts } from '@/context/GeneratingPostsContext'
import { getEffectiveStatusKey, getStatusCardClass, statusLabels } from '@/utils/socialStatusUtils'

interface SocialAutomationPostsGridProps {
  automationId: string
  statusFilter?: string
  page?: number
  limit?: number
  onPostClick?: (post: any) => void
  onTotalChange?: (total: number) => void
}

export function SocialAutomationPostsGrid({ 
  automationId, 
  statusFilter, 
  page = 1, 
  limit = 20, 
  onPostClick,
  onTotalChange 
}: SocialAutomationPostsGridProps) {
  const criteria = useMemo(() => {
    const base: any[] = []
    // Filter posts by this specific automation
    base.push({ key: 'automationId', value: automationId })
    
    if (statusFilter && statusFilter !== 'all') {
      base.push({ key: 'status', value: statusFilter })
    }
    return base
  }, [automationId, statusFilter])

  const { data: postsResult, isLoading } = useGetSocialPostsQuery({
    page,
    limit,
    sortfield: 'scheduledAt',
    direction: 'desc',
    criteria,
  })

  const generatingIds = useGeneratingPosts()
  const postingIds = usePostingPosts()
  const emailFailedIds = useEmailFailedPosts()

  React.useEffect(() => {
    if (postsResult?.total !== undefined) {
      onTotalChange?.(postsResult.total)
    }
  }, [postsResult, onTotalChange])

  const posts = postsResult?.data || []

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return <Share2 className="h-4 w-4" />;
      case 'instagram': return <Camera className="h-4 w-4" />;
      case 'linkedin': return <Briefcase className="h-4 w-4" />;
      case 'youtube': return <Play className="h-4 w-4" />;
      case 'twitter': return <Send className="h-4 w-4" />;
      default: return <Share2 className="h-4 w-4" />;
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return 'bg-[#1877F2]';
      case 'instagram': return 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888]';
      case 'linkedin': return 'bg-[#0A66C2]';
      case 'youtube': return 'bg-[#FF0000]';
      case 'twitter': return 'bg-[#000000]';
      default: return 'bg-slate-500';
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ProgressSpinner style={{ width: '40px', height: '40px' }} strokeWidth="4" fill="transparent" animationDuration=".5s" />
        <p className="text-sm font-bold text-[var(--color-text-muted)] animate-pulse">Loading posts...</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Clock className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No posts found</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-xs">
          Try changing your filter or check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-1">
      {posts.map((post) => {
        const postId = String(post._id)
        const isGenerating = generatingIds.has(postId)
        const isPosting = postingIds.has(postId)
        const isEmailFailed = emailFailedIds.has(postId)

        const displayStatus = isEmailFailed ? 'email_failed' : getEffectiveStatusKey(post)
        const isPaused = post.status === 'paused'
        
        const mediaUrl = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || post.videoUrl
        const platforms = Array.isArray(post.platforms) ? post.platforms : []

        return (
          <div 
            key={postId} 
            onClick={() => onPostClick?.(post)}
            className={cn(
              "group relative flex flex-col rounded-2xl border overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer",
              isPaused ? "bg-slate-50 border-slate-300 opacity-60 grayscale" : "bg-white border-slate-200 hover:-translate-y-1"
            )}
          >
            {/* Status Badge */}
            <div className="absolute top-3 right-3 z-10">
              {isGenerating ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm bg-violet-100/90 text-violet-700 border border-violet-200 backdrop-blur-md">
                  <Loader2 className="h-3 w-3 animate-spin text-violet-600" />
                  Generating AI...
                </div>
              ) : isPosting ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm bg-blue-100/90 text-blue-700 border border-blue-200 backdrop-blur-md">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  Posting...
                </div>
              ) : (
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm backdrop-blur-md border",
                  getStatusCardClass(displayStatus)
                )}>
                  {displayStatus === 'posted' || displayStatus === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : 
                   displayStatus === 'failed' || displayStatus === 'email_failed' ? <AlertCircle className="h-3 w-3" /> : 
                   displayStatus === 'content_generation_pending' ? <Sparkles className="h-3 w-3 text-amber-500" /> :
                   <Clock className="h-3 w-3" />}
                  {statusLabels[displayStatus] || displayStatus.replace(/_/g, ' ')}
                </div>
              )}
            </div>

            {/* Media Preview */}
            <div className="relative h-48 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
              {mediaUrl ? (
                post.videoUrl ? (
                  <div className="relative w-full h-full">
                    <video src={resolveApiAssetUrl(post.videoUrl)} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white">
                        <Play className="h-5 w-5 fill-current" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={resolveApiAssetUrl(mediaUrl)} 
                    alt={post.topic || 'Post media'} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <Sparkles className="h-10 w-10 opacity-20" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Text Preview</span>
                </div>
              )}
              
              {/* Platform Badges */}
              <div className="absolute bottom-3 left-3 flex gap-1">
                {platforms.map((p: string) => (
                  <div 
                    key={p} 
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-lg",
                      getPlatformColor(p)
                    )}
                    title={p}
                  >
                    {getPlatformIcon(p)}
                  </div>
                ))}
              </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col flex-1 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                  {post.postType === 'ai' ? 'AI Optimized' : 'Manual Entry'}
                </span>
              </div>
              
              <h4 className="text-sm font-black text-slate-800 line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">
                {post.topic || 'Untitled Post'}
              </h4>
              
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                {post.content}
              </p>

              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px] font-bold">
                    {new Date(post.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter group-hover:text-indigo-400 transition-colors">
                  Details →
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

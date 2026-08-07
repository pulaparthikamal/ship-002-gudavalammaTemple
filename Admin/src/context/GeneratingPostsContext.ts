import { createContext, useContext } from 'react'

/**
 * Holds the set of post IDs currently undergoing AI content generation.
 */
export const GeneratingPostsContext = createContext<Set<string>>(new Set())

export function useGeneratingPosts() {
  return useContext(GeneratingPostsContext)
}

/**
 * Holds the set of post IDs currently being sent/published (send-now API call).
 */
export const PostingPostsContext = createContext<Set<string>>(new Set())

export function usePostingPosts() {
  return useContext(PostingPostsContext)
}

/**
 * Holds the set of post IDs where the approval email sending failed.
 * This is client-side transient state (cleared on page refresh).
 */
export const EmailFailedPostsContext = createContext<Set<string>>(new Set())

export function useEmailFailedPosts() {
  return useContext(EmailFailedPostsContext)
}

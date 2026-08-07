import { Route, Routes } from 'react-router-dom'
import { MediaCategoriesPage } from '@/pages/MediaCategoriesPage'

export function MediaCategoriesRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MediaCategoriesPage />} />
    </Routes>
  )
}

export type VideoEntry = {
  id: string;
  title: string;
  category: string;
  description: string;
  /** Instagram embed iframe URL (https://www.instagram.com/p/{code}/embed/). */
  embedUrl?: string;
};

// Instagram videos shown in the "stories" section.
// To swap or add a video, just update the shortcode (the code in the post URL).
export const videoEntries: VideoEntry[] = [
  {
    id: 'ig-dhol-matrimony',
    title: 'Dhol Matrimony',
    category: 'Instagram',
    description: '@dhol.matrimony',
    embedUrl: 'https://www.instagram.com/p/DYSFruDSKnM/embed/captioned',
  },
  {
    id: 'ig-my-kismet',
    title: 'My Kismet Matrimonial',
    category: 'Instagram',
    description: '@mykismetmatrimonial',
    embedUrl: 'https://www.instagram.com/p/DcpXHxfpAxX/embed/captioned',
  },
  {
    id: 'ig-incredible-events',
    title: 'Incredible Events Company',
    category: 'Instagram',
    description: '@incredibleeventscompany',
    embedUrl: 'https://www.instagram.com/p/DAwE1UZogVh/embed/captioned',
  },
];

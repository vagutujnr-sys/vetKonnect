import buddy from "@/assets/pet-buddy.jpg";
import mia from "@/assets/pet-mia.jpg";
import hero from "@/assets/welcome-hero.jpg";
import type { CommunityPost } from "@/types";

export const mockPosts: CommunityPost[] = [
  {
    id: "post-1",
    author: "Tariro M.",
    location: "Harare",
    timeAgo: "2h ago",
    avatarUrl: hero,
    imageUrl: buddy,
    body: "Bruno had a great time at the park today. Regular walks keep him healthy and happy.",
    likes: 24,
    comments: 6,
    tag: "Story",
  },
  {
    id: "post-2",
    author: "Dr Munzeiwa",
    location: "Animal Farm",
    timeAgo: "5h ago",
    avatarUrl: mia,
    imageUrl: mia,
    body: "Cats hide pain well. Watch for reduced grooming, hiding, and appetite changes — these are early signs worth a check-up.",
    likes: 148,
    comments: 21,
    tag: "Education",
  },
  {
    id: "post-3",
    author: "Paws Rescue ZW",
    location: "Bulawayo",
    timeAgo: "1d ago",
    avatarUrl: buddy,
    imageUrl: hero,
    body: "Three rescued puppies are now fully vaccinated and ready for loving homes. Reach out if you can help.",
    likes: 312,
    comments: 47,
    tag: "Rescue",
  },
];

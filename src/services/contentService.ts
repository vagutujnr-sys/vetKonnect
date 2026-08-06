import { mockPosts } from "@/data/mockCommunity";
import { mockServices } from "@/data/mockServices";
import type { CommunityPost, ServiceListing } from "@/types";
import { delay, readLocal, writeLocal } from "./storage";

const SERVICES_KEY = "vetconnect.services";
const POSTS_KEY = "vetconnect.posts";

export async function getPosts(): Promise<CommunityPost[]> {
  await delay();
  return readLocal<CommunityPost[]>(POSTS_KEY, mockPosts);
}

export async function savePosts(posts: CommunityPost[]): Promise<void> {
  await delay();
  writeLocal(POSTS_KEY, posts);
}

export async function updatePost(id: string, patch: Partial<CommunityPost>): Promise<CommunityPost | undefined> {
  const posts = await getPosts();
  const index = posts.findIndex((post) => post.id === id);
  if (index === -1) return undefined;
  const updated = { ...posts[index], ...patch };
  posts[index] = updated;
  await savePosts(posts);
  return updated;
}

export async function deletePost(id: string): Promise<void> {
  const posts = await getPosts();
  await savePosts(posts.filter((post) => post.id !== id));
}

export async function getServices(): Promise<ServiceListing[]> {
  await delay();
  return readLocal<ServiceListing[]>(SERVICES_KEY, mockServices);
}

export async function saveServices(services: ServiceListing[]): Promise<void> {
  await delay();
  writeLocal(SERVICES_KEY, services);
}

export async function updateService(id: string, patch: Partial<ServiceListing>): Promise<ServiceListing | undefined> {
  const services = await getServices();
  const index = services.findIndex((service) => service.id === id);
  if (index === -1) return undefined;
  const updated = { ...services[index], ...patch };
  services[index] = updated;
  await saveServices(services);
  return updated;
}

export async function deleteService(id: string): Promise<void> {
  const services = await getServices();
  await saveServices(services.filter((service) => service.id !== id));
}

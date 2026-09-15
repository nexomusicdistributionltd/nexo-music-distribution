export type RosterArtist = {
  id: string;
  stage_name: string;
  artist_name: string;
  bio: string | null;
  country: string | null;
  genres: string[];
  avatar_url: string | null;
  website: string | null;
  user_id: string | null;
  created_by_label_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RosterArtistInput = {
  stage_name: string;
  country?: string | null;
  genres?: string[] | null;
  bio?: string | null;
  avatar_url?: string | null;
  website?: string | null;
};

import { siSpotify,siApplemusic,siYoutubemusic,siYoutube,siDeezer,siTidal,siSoundcloud,siAudiomack,siPandora,siShazam,siTiktok,siAmazon } from "simple-icons/icons";
type Icon={title:string;hex:string;path:string};
const icons:Record<string,Icon>={spotify:siSpotify,apple_music:siApplemusic,youtube_music:siYoutubemusic,youtube:siYoutube,deezer:siDeezer,tidal:siTidal,soundcloud:siSoundcloud,audiomack:siAudiomack,pandora:siPandora,amazon:siAmazon,amazon_music:siAmazon,shazam:siShazam,tiktok:siTiktok};
export function DspIcon({name,className="h-5 w-5"}:{name:string;className?:string}){const i=icons[name];if(!i)return null;return <svg className={className} role="img" viewBox="0 0 24 24" aria-label={i.title}><path fill="currentColor" d={i.path}/></svg>}

// Demo video links students paste: YouTube (incl. Shorts) and Google Drive files shared "anyone with the link".
const youTubeId = (url = '') => {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
  return m ? m[1] : null;
};
const driveId = (url = '') => {
  const m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/.exec(url || '');
  return m ? m[1] : null;
};

// Best picture for a project card / link preview, or null
const coverImage = (p) => {
  if (p.thumbnail) return p.thumbnail;
  if (p.screenshots?.length) return p.screenshots[0];
  const yt = youTubeId(p.videoUrl);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
};

module.exports = { youTubeId, driveId, coverImage };

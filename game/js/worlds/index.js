// All worlds and their tracks. A track id is "<world id>/<index>".
import backyard from './backyard.js';
import cabin from './cabin.js';
import lakeside from './lakeside.js';

export const WORLDS = [cabin, backyard, lakeside];

export const TRACKS = WORLDS.flatMap((world) => world.tracks.map((t, i) => ({ ...t, id: `${world.id}/${i}`, world })));

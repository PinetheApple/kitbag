import { found, type Database } from './repository';
import { songs, stemSets } from './schema';

export async function insertStemSet(db: Database, name: string) {
  const { id } = found(
    await db
      .insert(stemSets)
      .values({ name, createdAt: new Date(0), uuid: `uuid-${name}` })
      .returning({ id: stemSets.id }),
    'Stem set insert',
  );
  return id;
}

export async function insertSong(db: Database, title: string) {
  const { id } = found(
    await db
      .insert(songs)
      .values({
        title,
        artist: '',
        filePath: `songs/${title}.mp3`,
        duration: 1,
        format: 'mp3',
        createdAt: new Date(0),
        uuid: `uuid-${title}`,
      })
      .returning({ id: songs.id }),
    'Song insert',
  );
  return id;
}

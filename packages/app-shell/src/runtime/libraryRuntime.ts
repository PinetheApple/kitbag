import { openDatabase } from '@kitbag/core-db';
import { configureLibrary } from '@kitbag/core-state';

configureLibrary(openDatabase());

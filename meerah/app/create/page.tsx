import { redirect } from 'next/navigation';

/** `/create` opens the first tool. Each tool has its own URL under it. */
export default function CreateIndex() {
  redirect('/create/videngine');
}

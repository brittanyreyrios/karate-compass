/**
 * A staff-created child with no family yet has no photo permission from anyone,
 * so staff screens treat them as NO photos. Once claimed, the family's own
 * setting applies. Existing students are never affected.
 */
export function isUnclaimedNoPhotos(s: { parent_id?: string | null; created_by_staff?: boolean }) {
  return s.parent_id === null && s.created_by_staff === true;
}

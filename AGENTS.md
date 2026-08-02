<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Manual restore steps

### `album-covers` Storage bucket

This project's tooling rejects `INSERT` statements into `storage.buckets`, so the
bucket cannot be created through a migration. On a fresh database it must be
created manually before album cover uploads will work:

- **Bucket id / name:** `album-covers`
- **Public:** `false` (private — covers are served via short-lived signed URLs)
- **File size limit:** enforced client-side at 5 MB (no bucket-level limit set)
- **Allowed MIME types:** enforced client-side (`image/*` only)

The matching RLS policies live in migrations
`20260801234754_e12523bf-5932-41e7-b3ae-56ebd6383d63.sql` and
`20260801234844_502dab66-1eb9-45a5-92b9-f0aa622ec287.sql`:
- `SELECT` is allowed for any signed-in (`authenticated`) user.
- `INSERT`, `UPDATE`, and `DELETE` are restricted to users with the `admin` role.

Without this bucket, every album cover upload fails with a confusing error.

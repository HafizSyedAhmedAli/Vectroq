# Default rates

`pakistan-2026.csv` is the source for the shared default rate library that
every company uses out of the box. Load it once with:

    pnpm --filter @vectroq/web exec tsx scripts/import-rates.ts data/pakistan-2026.csv \
      --document "Vectroq default rates" --year 2026 --by "Vectroq" --shared

Companies override a city and category by importing their own CSV or adding
rates manually on the Rates page.

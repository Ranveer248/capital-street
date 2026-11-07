-- Capital Island: server upgrade 4 (Goal 43): plots on the Southern Isle.
--
-- Additive only: 22 new rows in public.ci_plot_sites (pl38 to pl59). No table or function changes: the plot, auction and island-trader
-- functions work for any row in that table. The prices use the same formula as the game (the kind's base price x 0.90 to 1.10 by the plot's
-- number, to the nearest 10), the same way pl0 to pl37 were priced in island3.sql. The game only shows these plots online once these rows exist.
-- Safe to run twice. Undo: island4-undo.sql (it keeps any plot a player has already bought).

insert into public.ci_plot_sites (id, kind, area, price, old, res) values
  ('pl38', 'town', 'Belle Rive', 1540, true, null),
  ('pl39', 'town', 'Belle Rive', 1470, true, null),
  ('pl40', 'town', 'Belle Rive', 1400, false, null),
  ('pl41', 'town', 'Belle Rive', 1330, true, null),
  ('pl42', 'town', 'Belle Rive', 1260, false, null),
  ('pl43', 'farm', 'Plaine des Cannes', 1060, false, null),
  ('pl44', 'farm', 'Plaine des Cannes', 1010, false, null),
  ('pl45', 'farm', 'Plaine des Cannes', 960, false, null),
  ('pl46', 'farm', 'Plaine des Cannes', 910, false, null),
  ('pl47', 'farm', 'Plaine des Cannes', 1070, false, null),
  ('pl48', 'farm', 'Plaine des Cannes', 1020, false, null),
  ('pl49', 'villa', 'Anse Perle', 3690, false, null),
  ('pl50', 'villa', 'Anse Perle', 3500, true, null),
  ('pl51', 'villa', 'Anse Perle', 4100, false, null),
  ('pl52', 'town', 'Pointe Filaos', 1440, true, null),
  ('pl53', 'town', 'Pointe Filaos', 1370, true, null),
  ('pl54', 'town', 'Pointe Filaos', 1300, true, null),
  ('pl55', 'stone', 'Mont Brumeux quarry', 1740, false, 'stone'),
  ('pl56', 'stone', 'Mont Brumeux quarry', 1660, false, 'stone'),
  ('pl57', 'industrial', 'Moulin Doré yard', 2380, false, null),
  ('pl58', 'harbour', 'Belle Rive quay', 3380, false, null),
  ('pl59', 'tower', 'Belle Rive', 4620, false, null)
on conflict (id) do nothing;

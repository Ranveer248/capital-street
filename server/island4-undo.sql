-- Undo for island4.sql: removes the Southern Isle plot rows that nobody has bought. (A plot a player owns keeps its row, so nothing they paid for disappears.)
delete from public.ci_plot_sites s where s.id in ('pl38', 'pl39', 'pl40', 'pl41', 'pl42', 'pl43', 'pl44', 'pl45', 'pl46', 'pl47', 'pl48', 'pl49', 'pl50', 'pl51', 'pl52', 'pl53', 'pl54', 'pl55', 'pl56', 'pl57', 'pl58', 'pl59')
  and not exists (select 1 from public.ci_plots p where p.id = s.id) and not exists (select 1 from public.ci_auctions a where a.plot = s.id);

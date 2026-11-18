-- The line the map draws for a street route, as a list of {lat, lng} points
-- following the street from one corner to the other. It is worked out from
-- Google's walking directions when the route is created or its corners change,
-- and saved here, so the map never asks Google again just to draw it.
--
-- Null for a drop, which is one point and draws as a pin, and for a street route
-- with no walk that keeps to the street, which the map draws as a straight line.

alter table volunteer_routes add column path jsonb;

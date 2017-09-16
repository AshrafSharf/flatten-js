"use strict";

module.exports = function(Flatten) {
    let {Polygon, Point, Segment, Arc, Circle, Line, Ray, Vector} = Flatten;

    let {vector} = Flatten;

    Flatten.Distance = class Distance {
        /**
         * Calculate distance and shortest segment between points
         * @param pt1
         * @param pt2
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static point2point(pt1, pt2) {
            return [pt1.distanceTo(pt2), new Segment(pt1, pt2)];
        }

        /**
         * Calculate distance and shortest segment between point and line
         * @param pt
         * @param line
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static point2line(pt, line) {
            let closest_point = pt.projectionOn(line);
            let vec = vector(pt, closest_point);
            return [vec.length, new Segment(pt, closest_point)];
        }

        /**
         * Calculate distance and shortest segment between point and circle
         * @param pt
         * @param circle
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static point2circle(pt, circle) {
            let dist2center = pt.distanceTo(circle.center);
            if (Flatten.Utils.EQ_0(dist2center)) {
                return [circle.r, new Segment(pt, circle.toArc().start)];
            }
            else {
                let dist = Math.abs(dist2center - circle.r);
                let v = vector(circle.pc, pt).normalize().multiply(circle.r);
                let closest_point = circle.pc.translate(v);
                return [dist, new Segment(pt, closest_point)];
            }
        }

        /**
         * Calculate distance and shortest segment between point and segment
         * @param pt
         * @param segment
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static point2segment(pt, segment) {
            /* Degenerated case of zero-length segment */
            if (segment.start.equalTo(segment.end)) {
                return  Distance.point2point(pt, segment.start);
            }

            let v_seg = new Flatten.Vector(segment.start, segment.end);
            let v_ps2pt = new Flatten.Vector(segment.start, pt);
            let v_pe2pt = new Flatten.Vector(segment.end, pt);
            let start_sp = v_seg.dot(v_ps2pt);
            /* dot product v_seg * v_ps2pt */
            let end_sp = -v_seg.dot(v_pe2pt);
            /* minus dot product v_seg * v_pe2pt */

            let dist;
            let closest_point;
            if (Flatten.Utils.GE(start_sp, 0) && Flatten.Utils.GE(end_sp, 0)) {    /* point inside segment scope */
                let v_unit = segment.tangentInStart(); // new Flatten.Vector(v_seg.x / this.length, v_seg.y / this.length);
                /* unit vector ||v_unit|| = 1 */
                dist = Math.abs(v_unit.cross(v_ps2pt));
                /* dist = abs(v_unit x v_ps2pt) */
                closest_point = segment.start.translate(v_unit.multiply(v_unit.dot(v_ps2pt)));
            }
            else if (start_sp < 0) {                             /* point is out of scope closer to ps */
                dist = pt.distanceTo(segment.start);
                closest_point = segment.start.clone();
            }
            else {                                               /* point is out of scope closer to pe */
                dist = pt.distanceTo(segment.end);
                closest_point = segment.end.clone();
            }
            return [dist, new Segment(pt, closest_point)];
        };

        /**
         * Calculate distance and shortest segment between point and arc
         * @param pt
         * @param arc
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static point2arc(pt, arc) {
            let circle = new Flatten.Circle(arc.pc, arc.r);
            let dist_and_segments = [];
            let dist, shortest_segment;
            [dist, shortest_segment] = Distance.point2circle(pt, circle);
            if (shortest_segment.end.on(arc)) {
                dist_and_segments.push(Distance.point2circle(pt, circle));
            }
            dist_and_segments.push( Distance.point2point(pt, arc.start) );
            dist_and_segments.push( Distance.point2point(pt, arc.end) );

            Distance.sort(dist_and_segments);

            return dist_and_segments[0];
        }

        /**
         * Calculate distance and shortest segment between segment and line
         * @param seg
         * @param line
         * @returns {[number,null]}
         */
        static segment2line(seg, line) {
            let ip = seg.intersect(line);
            if (ip.length > 0) {
                return [0, new Segment(ip[0],ip[0])];   // distance = 0, closest point is the first point
            }

            dist_and_segment.push(Distance.point2line(seg.start, line));
            dist_and_segment.push(Distance.point2line(seg.end, line));

            Distance.sort( dist_and_segment );
            return dist_and_segment[0];

        }

        /**
         * Calculate distance and shortest segment between two segments
         * @param seg1
         * @param seg2
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static segment2segment(seg1, seg2) {
            let ip = Segment.intersectSegment2Segment(seg1, seg2);
            if (ip.length > 0) {
                return [0, new Segment(ip[0],ip[0])];   // distance = 0, closest point is the first point
            }

            // Seg1 and seg2 not intersected
            let dist_and_segment = [];

            dist_and_segment.push(Distance.point2segment(seg2.start, seg1));
            dist_and_segment.push(Distance.point2segment(seg2.end, seg1));
            dist_and_segment.push(Distance.point2segment(seg1.start, seg2));
            dist_and_segment.push(Distance.point2segment(seg1.end, seg2));

            Distance.sort( dist_and_segment );
            return dist_and_segment[0];
        }

        /**
         * Calculate distance and shortest segment between segment and circle
         * @param seg
         * @param circle
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static segment2circle(seg, circle) {
            /* Case 1 Segment and circle intersected. Return the first point and zero distance */
            let ip = seg.intersect(circle);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            // No intersection between segment and circle

            /* Case 2. Distance to projection of center point to line bigger than radius
             * And projection point belong to segment
              * Then measure again distance from projection to circle and return it */
            let line = new Flatten.Line(seg.ps, seg.pe);
            let [dist, shortest_segment] = Distance.point2line(circle.center, line);
            if (Flatten.Utils.GE(dist, circle.r) && shortest_segment.end.on(seg)) {
                return Distance.point2circle(shortest_segment.start, circle);
            }
            /* Case 3. Otherwise closest point is one of the end points of the segment */
            else {
                let [dist_from_start, shortest_segment_from_start] = Distance.point2circle(seg.start, circle);
                let [dist_from_end, shortest_segment_from_end] = Distance.point2circle(seg.end, circle);
                return Flatten.Utils.LT(dist_from_start, dist_from_end) ?
                    [dist_from_start, shortest_segment_from_start] :
                    [dist_from_end, shortest_segment_from_end];
            }
        }

        /**
         * Calculate distance and shortest segment between segment and arc
         * @param seg
         * @param arc
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static segment2arc(seg, arc) {
            /* Case 1 Segment and arc intersected. Return the first point and zero distance */
            let ip = seg.intersect(arc);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            // No intersection between segment and arc
            let line = new Flatten.Line(seg.ps, seg.pe);
            let circle = new Flatten.Circle(arc.pc, arc.r);

            /* Case 2. Distance to projection of center point to line bigger than radius AND
             * projection point belongs to segment AND
               * distance from projection point to circle belongs to arc  =>
               * return this distance from projection to circle */
            let [dist_from_center, shortest_segment_from_center] = Distance.point2line(circle.center, line);
            if (Flatten.Utils.GE(dist_from_center, circle.r) && shortest_segment_from_center.end.on(seg)) {
                let [dist_from_projection, shortest_segment_from_projection] =
                    Distance.point2circle(shortest_segment_from_center.end, circle);
                if (shortest_segment_from_projection.end.on(arc)) {
                    return [dist_from_projection, shortest_segment_from_projection];
                }
            }
            /* Case 3. Otherwise closest point is one of the end points of the segment */
            else {
                let dist_and_segment = [];
                dist_and_segment.push( Distance.point2arc(seg.start, arc) );
                dist_and_segment.push( Distance.point2arc(seg.end, arc) );

                Distance.sort(dist_and_segment);
                return dist_and_segment[0];
            }
        }

        /**
         * Calculate distance and shortest segment between two circles
         * @param circle1
         * @param circle2
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static circle2circle(circle1, circle2) {
            let ip = circle1.intersect(circle2);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            // Case 1. Concentric circles. Convert to arcs and take distance between two arc starts
            if (circle1.center.equalTo(circle2.center)) {
                let arc1 = circle1.toArc();
                let arc2 = circle2.toArc();
                return Distance.point2point(arc1.start, arc2.start);
            }
            else {
                // Case 2. Not concentric circles
                let line = new Line(circle1.center, circle2.center);
                let ip1 = line.intersect(circle1);
                let ip2 = line.intersect(circle2);

                let dist_and_segment = [];

                dist_and_segment.push(Distance.point2point(ip1[0], ip2[0]));
                dist_and_segment.push(Distance.point2point(ip1[0], ip2[1]));
                dist_and_segment.push(Distance.point2point(ip1[1], ip2[1]));
                dist_and_segment.push(Distance.point2point(ip1[1], ip2[2]));

                Distance.sort(dist_and_segment);
                return dist_and_segment[0];
            }
        }

        /**
         * Calculate distance and shortest segment between two circles
         * @param circle
         * @param line
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static circle2line(circle, line) {
            let ip = circle.intersect(line);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let [dist_from_center, shortest_segment_from_center] = Distance.point2line(circle.center, line);
            let [dist, shortest_segment] = Distance.point2point(shortest_segment_from_center.end, circle);
            shortest_segment = shortest_segment.swap();
            return [dist, shortest_segment];
        }

        /**
         * Calculate distance and shortest segment between arc and line
         * @param arc
         * @param line
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static arc2line(arc, line) {
            /* Case 1 Line and arc intersected. Return the first point and zero distance */
            let ip = line.intersect(arc);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let circle = new Flatten.Circle(arc.center, arc.r);

            /* Case 2. Distance to projection of center point to line bigger than radius AND
             * projection point belongs to segment AND
               * distance from projection point to circle belongs to arc  =>
               * return this distance from projection to circle */
            let [dist_from_center, shortest_segment_from_center] = Distance.point2line(circle.center, line);
            if (Flatten.Utils.GE(dist_from_center, circle.r)) {
                let [dist_from_projection, shortest_segment_from_projection] =
                    Distance.point2circle(shortest_segment_from_center.end, circle);
                if (shortest_segment_from_projection.end.on(arc)) {
                    return [dist_from_projection, shortest_segment_from_projection];
                }
            }
            else {
                let dist_and_segment = [];
                dist_and_segment.push( Distance.point2line(arc.start, line) );
                dist_and_segment.push( Distance.point2line(arc.end, line) );

                Distance.sort(dist_and_segment);
                return dist_and_segment[0];
            }
        }

        /**
         * Calculate distance and shortest segment between arc and circle
         * @param arc
         * @param circle2
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static arc2circle(arc, circle2) {
            let ip = arc.intersect(circle2);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let circle1 = new Flatten.Circle(arc.center, arc.r);

            let [dist, shortest_segment] = Distance.circle2circle(circle1, circle2);
            if (shortest_segment.start.on(arc)) {
                return [dist, shortest_segment];
            }
            else {
                let dist_and_segment = [];

                dist_and_segment.push(Distance.point2circle(arc.start, circle2));
                dist_and_segment.push(Distance.point2circle(arc.end, circle2));

                Distance.sort(dist_and_segment);

                return dist_and_segment[0];
            }
        }

        /**
         * Calculate distance and shortest segment between two arcs
         * @param arc1
         * @param arc2
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static arc2arc(arc1, arc2) {
            let ip = arc1.intersect(arc2);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let circle1 = new Flatten.Circle(arc1.center, arc1.r);
            let circle2 = new Flatten.Circle(arc2.center, arc2.r);

            let [dist, shortest_segment] = Distance.circle2circle(circle1, circle2);
            if (shortest_segment.start.on(arc1) && shortest_segment.end.on(arc2)) {
                return [dist, shortest_segment];
            }
            else {
                let dist_and_segment = [];

                dist_and_segment.push(Distance.point2circle(arc1.start, arc2));
                dist_and_segment.push(Distance.point2circle(arc1.end, arc2));

                Distance.sort(dist_and_segment);

                return dist_and_segment[0];
            }
        }

        /**
         * Calculate distance and shortest segment between point and polygon
         * @param point
         * @param polygon
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static point2polygon(point, polygon) {
            if (point.on(polygon)) {
                return [0, new Segment(point, point)];
            }

            let min_dist_and_segment = [Number.POSITIVE_INFINITY, new Segment()];
            for (let edge of polygon.edges) {
                let [dist, shortest_segment] = point.distanceTo(edge.shape);
                if (Flatten.Utils.LT(dist, min_dist_and_segment[0])) {
                    min_dist_and_segment = [dist, shortest_segment];
                }
            }

            return min_dist_and_segment;
        }

        static segment2polygon(segment, polygon) {
            let ip = segment.intersect(polygon);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let min_dist_and_segment = [Number.POSITIVE_INFINITY, new Segment()];
            for (let edge of polygon.edges) {
                let [dist, shortest_segment] = segment.distanceTo(edge.shape);
                if (Flatten.Utils.LT(dist, min_dist_and_segment[0])) {
                    min_dist_and_segment = [dist, shortest_segment];
                }
            }
            return min_dist_and_segment;
        }

        static arc2polygon(arc, polygon) {
            let ip = arc.intersect(polygon);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let min_dist_and_segment = [Number.POSITIVE_INFINITY, new Segment()];
            for (let edge of polygon.edges) {
                let [dist, shortest_segment] = arc.distanceTo(edge.shape);
                if (Flatten.Utils.LT(dist, min_dist_and_segment[0])) {
                    min_dist_and_segment = [dist, shortest_segment];
                }
            }
            return min_dist_and_segment;
        }

        static line2polygon(line, polygon) {
            let ip = line.intersect(polygon);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let min_dist_and_segment = [Number.POSITIVE_INFINITY, new Segment()];
            for (let edge of polygon.edges) {
                let [dist, shortest_segment] = line.distanceTo(edge.shape);
                if (Flatten.Utils.LT(dist, min_dist_and_segment[0])) {
                    min_dist_and_segment = [dist, shortest_segment];
                }
            }
            return min_dist_and_segment;
        }

        static circle2polygon(circle, polygon) {
            let ip = circle.intersect(polygon);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let min_dist_and_segment = [Number.POSITIVE_INFINITY, new Segment()];
            for (let edge of polygon.edges) {
                let [dist, shortest_segment] = circle.distanceTo(edge.shape);
                if (Flatten.Utils.LT(dist, min_dist_and_segment[0])) {
                    min_dist_and_segment = [dist, shortest_segment];
                }
            }
            return min_dist_and_segment;
        }

        /**
         * Calculate distance and shortest segment between point and polygon
         * @param polygon1
         * @param polygon2
         * @returns {[dist, segment]} - distance and shortest segment
         */
        static polygon2polygon(polygon1, polygon2) {
            let ip = polygon1.intersect(polygon2);
            if (ip.length > 0) {
                return [0, new Segment(ip[0], ip[0])];
            }

            let min_dist_and_segment = [Number.POSITIVE_INFINITY, new Segment()];
            for (let edge1 of polygon1.edges) {
                for (let edge2 of polygon2.edges) {
                    let [dist, shortest_segment] = edg1e.shape.distanceTo(edge2.shape);
                    if (Flatten.Utils.LT(dist, min_dist_and_segment[0])) {
                        min_dist_and_segment = [dist, shortest_segment];
                    }
                }
            }
            return min_dist_and_segment;
        }

        static sort(dist_and_segment) {
            dist_and_segment.sort((d1, d2) => {
                if (Flatten.Utils.LT(d1[0], d2[0])) {
                    return -1;
                }
                if (Flatten.Utils.GT(d1[0], d2[0])) {
                    return 1;
                }
                return 0;
            });
        }

        distance(shape1, shape2) {
            return shape1.distanceTo(shape2);
        }
    }
};
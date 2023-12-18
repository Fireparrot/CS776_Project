'use strict';

const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
};

var PI = 3.14159265358979;

function vec_add(a, b) {
    return a.map((e, i) => e + b[i]);
}
function vec_sub(a, b) {
    return a.map((e, i) => e - b[i]);
}
function vec_mul(a, m) {
    return a.map(e => e * m);
}
function vec_div(a, m) {
    return a.map(e => e / m);
}
function dot(a, b) {
    var total = 0;
    for(var i = 0; i < a.length && i < b.length; ++i) {
        total += a[i] * b[i];
    }
    return total;
}

var pop_size = 20;
var cross_prob = 1.0;
var sbx_n = 2;
var blx_alpha = 0.5;

var max_gens = 200;
var epsilon_x = 0.1e-4;
var epsilon_y = 0.1e-4;
var amount_runs = 20;

var current_generation;
var func_graph = {};
var generation_graph = {};
var history_fitness = [];
var history_fitness_graph = {};
var history_value_graph = {};
var runs_stats = [0, 0, 0, 0];


function func_v(xs) {
    var x = xs[0];
    return Math.abs(x - 0.5);
}
function func_v_cliff(xs) {
    var x = xs[0];
    return x < 0.5 ? 0.6 - x : x - 0.5;
}
function func_bimodal_equal(xs) {
    var x = xs[0];
    return x <= 0.5 ? -Math.exp((x-0.25)**2/-0.01) : -Math.exp((x-0.75)**2/-0.01);
}
function func_bimodal_unequal(xs) {
    var x = xs[0];
    return x <= 0.3 ? -Math.exp((x-0.2)**2/-0.00016) : -0.5*Math.exp((x-0.6)**2/-0.16);
}
function func_pole(xs) {
    var xi = [0.4, 0.3, 0.7, 0.8];
    var yi = [0.3, 0.7, 0.2, 0.8];
    var ci = [1.0, 1.0, 1.0, 1.125];
    var hi = [0.1, 0.1, 0.1, 0.075];
    var x = xs[0], y = xs[1];
    var total = 0;
    for(var i = 0; i < 4; ++i) {
        total += ci[i]*hi[i] / (hi[i]**2 + (x - xi[i])**2 + (y - yi[i])**2)**(3/2);
    }
    return -total;
}
function func_dejong1(xs) {
    var total = 0;
    for(var i = 0; i < 3; ++i) {
        total += xs[i]**2;
    }
    return total;
}
function func_dejong2(xs) {
    var total = 0;
    for(var i = 0; i < 1; ++i) {
        total += 100 * (xs[i+1] - xs[i]**2)**2 + (xs[i] - 1)**2;
    }
    return total;
}
function func_dejong3(xs) {
    var total = 0;
    for(var i = 0; i < 5; ++i) {
        total += Math.abs(Math.floor(xs[i]) + 6);
    }
    return total;
}
function func_dejong4(xs) {
    var total = Math.random();
    for(var i = 0; i < 30; ++i) {
        total += (i+1) * xs[i]**4;
    }
    return total;
}
function func_dejong5(xs) {
    var aij =
        [Array.from({length: 25}, (x, i) => ((i%5)-2)*16),
         Array.from({length: 25}, (x, i) => (Math.floor(i/5)-2)*16)];
    var total = 0;
    for(var j = 0; j < 25; ++j) {
        var subtotal = j+1;
        for(var i = 0; i < 2; ++i) {
            subtotal += (xs[i] - aij[i][j])**6;
        }
        total += 1/subtotal;
    }
    total = -1 + 1/(1/500 + total);
    return total;
}
function func_rastrigin(xs) {
    var total = 0;
    for(var i = 0; i < 20; ++i) {
        total += xs[i]**2 + 10*(1 - Math.cos(2*PI * xs[i]));
    }
    return total;
}
function func_blocked(xs) {
    var ai = [0.002, 0.0025, 0.014, 0.003, 0.0028];
    var bi = [0.002, 0.0020, 0.003, 0.001, 0.0010];
    var ci = [0.1, 0.9, 0.45, 0.27, 0.65];
    var ri = [0, 0, 10, 10, 10];
    var x1 = xs[0], x2 = [1];
    var total = ((x1 - 0.4)**2);
    for(var i = 0; i < 5; ++i) {
        total -= ai[i] / (bi[i] + ri[i] * (x1 - 0.4)**2 + (x2 - ci[i])**2);
    }
    return total;
}

var funcs =
    [func_v, func_v_cliff, func_bimodal_equal, func_bimodal_unequal, func_pole, 
    func_dejong1, func_dejong2, func_dejong3, func_dejong4, func_dejong5,
    func_rastrigin, func_blocked];
var funcs_xs_min =
    [[0.5], [0.5], [0.25], [0.2], [0.8, 0.8],
    [0, 0, 0], [1, 1], [-5.12, -5.12, -5.12, -5.12, -5.12], Array.from({length: 30}, (x, i) => 0), [-32, -32],
    Array.from({length: 20}, (x, i) => 0), [0.4, 0.45]];
var funcs_y_min = [0, 0, -1, -1, func_pole([0.8, 0.8]),
    0, 0, 0, 0, 0,
    0, func_blocked([0.4, 0.45])];
var funcs_name =
    ["V function", "V-cliff function", "bimodal (equal)", "bimodal (unequal)", "pole function",
    "DeJong 1", "DeJong 2", "DeJong 3", "DeJong 4", "DeJong 5",
    "Rastrigin", "blocked function"];

var funcs_init_mean = funcs_xs_min;
var funcs_init_radius = 
    [0.5, 0.5, 0.5, 0.5, 1,
    5.12, 2.048, 5.12, 1.28, 65.536,
    6, 0.5];

var funcs_mean = funcs_xs_min;
var funcs_axis1 =
    [[1], [1], [1], [1], [1, 0],
    [1, 0, 0], [1, 0], [1, 0, 0, 0, 0], Array.from({length: 30}, (x, i) => (i == 0 ? 1 : 0)), [1, 0],
    Array.from({length: 20}, (x, i) => (i == 0 ? 1 : 0)), [1, 0]];
var funcs_radius = funcs_init_radius;

var func_id;
var func;
var func_pos;
var func_axis1;
var func_radius;

function extract_array(value) {
    value = value.replace('[', '').replace(']', '');
    value = value.split(',').map(e => parseFloat(e));
    for(var i = 0; i < value.length; ++i) {
        if(typeof value[i] != 'number' || isNaN(value[i])) return;
    }
    return value;
}

function set_init_mean() {
    var value = extract_array(document.getElementById('init_mean').value);
    if(value != null && value.length == funcs_xs_min[func_id].length) {
        funcs_init_mean[func_id] = value;
    }
    document.getElementById('init_mean').value = funcs_init_mean[func_id];
}
function set_init_radius() {
    var value = parseFloat(document.getElementById('init_radius').value);
    if(value != null) {
        funcs_init_radius[func_id] = value;
    }
    document.getElementById('init_radius').value = funcs_init_radius[func_id];
}
function set_pop_size() {
    var value = parseInt(document.getElementById('pop_size').value);
    if(value != null && value >= 1) {
        pop_size = value;
    }
    document.getElementById('pop_size').value = pop_size;
}
function set_cross_prob() {
    var value = parseFloat(document.getElementById('cross_prob').value);
    if(value != null && value <= 1.0 && value >= 0.0) {
        cross_prob = value;
    }
    document.getElementById('cross_prob').value = cross_prob;
}
function set_sbx_n() {
    var value = parseFloat(document.getElementById('sbx_n').value);
    if(value != null) {
        sbx_n = value;
    }
    document.getElementById('sbx_n').value = sbx_n;
}
function set_amount_runs() {
    var value = parseInt(document.getElementById('amount_runs').value);
    if(value != null && value >= 1) {
        amount_runs = value;
    }
    document.getElementById('amount_runs').value = amount_runs;
}


function generate_init_generation() {
    history_fitness_graph.data = new google.visualization.DataTable();
    history_fitness_graph.data.addColumn('number', 'T');
	history_fitness_graph.data.addColumn('number', 'ave');
    history_fitness_graph.data.addColumn('number', 'max');
	history_fitness_graph.options = {
		hAxis: {
			title: 'generation #',
			format: '0',
            minValue: 0,
            maxValue: 1
		},
		vAxis: {
			title: 'fitness'
		}
	};
    history_fitness_graph.chart = new google.visualization.LineChart(document.getElementById('fitness_graph'));

    history_value_graph.data = new google.visualization.DataTable();
    history_value_graph.data.addColumn('number', 'T');
	history_value_graph.data.addColumn('number', 'ave');
    history_value_graph.data.addColumn('number', 'min');
	history_value_graph.options = {
		hAxis: {
			title: 'generation #',
			format: '0',
            minValue: 0,
            maxValue: 1
		},
		vAxis: {
			title: 'value'
		}
	};
    history_value_graph.chart = new google.visualization.LineChart(document.getElementById('value_graph'));

    current_generation = new Generation();
    var pops = Array.from({length: pop_size});
    var mean = funcs_init_mean[func_id];
    var radius = funcs_init_radius[func_id];
    for(var i = 0; i < pop_size; ++i) {
        var random_dir = Array.from({length: mean.length}, (e, i) => Math.random()*2-1);
        pops[i] = new Pop(vec_add(mean, vec_mul(random_dir, radius)));
    }
    current_generation.set_pops(pops);
    generate_generation_graph();
    generate_fitness_value_graph();
}

function webpage_setup() {
    var html_select = document.getElementById('func_selector');
    for(var i = 0; i < funcs_name.length; ++i) {
        var html_option = document.createElement('option');
        html_option.value = i;
        html_option.innerHTML = funcs_name[i];
        html_select.appendChild(html_option);
    }
}

function func_selection() {
    func_id = document.getElementById('func_selector').options.selectedIndex;
    func = funcs[func_id];
    func_pos = funcs_mean[func_id];
    func_axis1 = funcs_axis1[func_id];
    func_radius = funcs_radius[func_id];
    document.getElementById('init_mean').value = funcs_init_mean[func_id];
    document.getElementById('init_radius').value = funcs_init_radius[func_id];
    generate_func_graph();
}

function generate_func_graph() {
    func_graph.data = new google.visualization.DataTable();
    func_graph.data.addColumn('number', 'X');
	func_graph.data.addColumn('number', 'Y');
	func_graph.options = {
		hAxis: {
			title: 'r',
			format: '0'
		},
		vAxis: {
			title: ''
		}
	};
    func_graph.chart = new google.visualization.LineChart(document.getElementById('func_graph'));

    for(var x = -1; x < 1; x += 0.002) {
        var pos = vec_add(func_pos, vec_mul(func_axis1, x*func_radius));
        func_graph.data.addRow([x*func_radius, func(pos)]);
    }
    func_graph.chart.draw(func_graph.data, func_graph.options);
}
function generate_generation_graph() {
    var axis = vec_sub(current_generation.mean, funcs_xs_min[func_id]);
    var mag = Math.sqrt(dot(axis, axis));
    axis = mag < 1.e-7 ? func_axis1 : vec_div(axis, mag);
    document.getElementById('generation_axis1').innerHTML = "axis: " + axis;
    document.getElementById('target').innerHTML = "target: " + funcs_xs_min[func_id];
    document.getElementById('generation_best').innerHTML = "best: " + current_generation.get_best_pop().point;
    document.getElementById('generation_mean').innerHTML = "mean: " + current_generation.mean;
    
    generation_graph.data = new google.visualization.DataTable();
    generation_graph.data.addColumn('number', 'X');
	generation_graph.data.addColumn('number', 'Y');
    generation_graph.data.addColumn('number', 'Yhat');
	generation_graph.options = {
		hAxis: {
			title: 'r',
			format: '0',
            minValue: -func_radius,
            maxValue: func_radius
		},
		vAxis: {
			title: ''
		},
        legend: 'none',
        colors: ['#0000FF', '#000000'],
        pointShape: 'star',
        pointSize: 5,
        series: {
            0: {
                type: 'line',
                lineWidth: 0.1,
                pointSize: 0.1
            },
            1: {
                type: 'scatter',
                visibleInLegend: false,
            }
        }
	};
    generation_graph.chart = new google.visualization.LineChart(document.getElementById('generation_graph'));

    var pops = current_generation.pops;
    for(var x = -1; x < 1; x += 0.002) {
        var pos = vec_add(current_generation.mean, vec_mul(axis, x*func_radius)); // func_pos -> current_generation.mean
        generation_graph.data.addRow([x*func_radius, func(pos), null]);
    }
    for(var pop of pops) {
        generation_graph.data.addRow([dot(vec_sub(pop.point, current_generation.mean), axis), null, pop.value]);
    }
    generation_graph.chart.draw(generation_graph.data, generation_graph.options);
}

function generate_fitness_value_graph() {
    history_fitness_graph.chart.draw(history_fitness_graph.data, history_fitness_graph.options);
    history_value_graph.chart.draw(history_value_graph.data, history_value_graph.options);
}

function generate_graphs() {
    func_graph = {};
    generate_func_graph();
    generate_generation_graph();
}



function generate_sbx_beta() {
    var cdf_y = Math.random();
    return cdf_y < 0.5 ?
        (2*cdf_y) ** (1/(sbx_n+1)) :
        (2*cdf_y-1) ** (-1/(sbx_n+1));
}

class Pop {
    constructor(point) {
        this.point = point;
        this.value = funcs[func_id](point);
        this.fitness = 100 / (1 + this.value - funcs_y_min[func_id]);
    }
}
class Generation {
    constructor() {
        this.pops = [];
        this.count = 0;
        this.value_stats = [];
        this.fitness_stats = [];
        this.mean = [];
        this.covariance = [];
    }
    set_pops(pops) {
        this.pops = pops;

        var fitness_ave = 0;
        var fitness_max = 0;
        var value_ave = 0;
        var value_min = 0;
        this.mean = Array.from({length: pops[0].point.length}, (e, i) => 0);
        for(var pop of pops) {
            fitness_ave += pop.fitness;
            fitness_max = Math.max(fitness_max, pop.fitness);
            value_ave += pop.value;
            value_min = Math.min(value_min, pop.value);
            this.mean = vec_add(this.mean, pop.point);
        }
        fitness_ave /= pops.length;
        value_ave /= pops.length;
        this.mean = vec_mul(this.mean, 1/pops.length);
        
//        this.covariance = Array.from({length: this.mean.length}, (e, i) => Array.from({length: this.mean.length}, (e, i) => 0));
//        for(var pop1 of this.pops) {
//            for(var pop2 of this.pops) {
//                for(var i = 0; i < this.mean.length; ++i) {
//                    for(var j = 0; j < this.mean.length; ++j) {
//                        this.covariance[i][j] += 0;
//                    }
//                }
//            }
//        }

        this.fitness_stats = [fitness_ave, fitness_max];
        this.value_stats = [value_ave, value_min];

        history_fitness_graph.data.addRow([this.count, fitness_ave, fitness_max]);
        history_value_graph.data.addRow([this.count, value_ave, value_min]);
        ++this.count;

        generate_generation_graph();
        generate_fitness_value_graph();
    }
    get_best_pop() {
        var best_pop = this.pops[0];
        for(var pop of this.pops)
            if(pop.fitness > best_pop.fitness)
                best_pop = pop;
        return best_pop;
    }
}

function sbx_cross(pop1, pop2) {
    if(Math.random() > cross_prob)
        return [pop1, pop2];
    var mean = Array.from({length: pop1.point.length}, (e, i) => (pop1.point[i] + pop2.point[i])/2);
    var delta = Array.from({length: pop1.point.length}, (e, i) => generate_sbx_beta()*Math.abs(pop1.point[i] - pop2.point[i])/2);
    var point1 = vec_add(mean, delta);
    var point2 = vec_add(mean, vec_mul(delta, -1));
    return [new Pop(point1), new Pop(point2)];
}
function tournament_round(pop1, pop2) {
    return pop1.fitness > pop2.fitness ? pop1 : pop2;
}
function tournament(pops) {
    var random_indices = Array.from({length: pops.length}, (e, i) => i);
    random_indices.sort((e1, e2) => Math.random() > 0.5 ? -1 : 1);
    return Array.from({length: pops.length}, (e, i) => tournament_round(pops[i], pops[random_indices[i]]));
}

function do_next_gen() {
    var parents = tournament(current_generation.pops);
    var children = [];
    for(var i = 0; i < parents.length/2; ++i) {
        children = children.concat(sbx_cross(parents[2*i], parents[2*i+1]));
    }
    current_generation.set_pops(children);
}

function near_true_xs() {
    var delta = vec_sub(current_generation.get_best_pop().point, funcs_xs_min[func_id]);
    for(var x of delta)
        if(Math.abs(x) > epsilon_x)
            return false;
    return true;
}
function near_true_y() {
    return Math.abs(current_generation.get_best_pop().value - funcs_y_min[func_id]) < epsilon_y;
}
function premature_convergence() {
    var mean = current_generation.mean;
    var SD = Array.from({length: mean.length}, (e, i) => 0);
    for(var pop of current_generation.pops) {
        var delta = vec_sub(pop.point, mean);
        for(var i = 0; i < mean.length; ++i)
            SD[i] += delta[i]**2;
    }
    SD = vec_div(SD, current_generation.pops.length);
    for(var s of SD)
        if(Math.sqrt(s)*5 > epsilon_x)
            return false;
    return true;
}
function exceeded_gens() {
    return current_generation.count > max_gens;
}
function should_stop() {
    if(near_true_xs()) return 1;
    if(near_true_y()) return 2;
    if(premature_convergence()) return 3;
    if(exceeded_gens()) return 4;
    return 0;
}
function do_all_gens(remaining_runs = 1) {
    if(typeof remaining_runs != 'number') remaining_runs = 1;
    //console.log("called " + remaining_runs);
    if(remaining_runs < 1) return;
    if(current_generation == null)
        generate_init_generation();
    if(!should_stop()) {
        do_next_gen();
        setTimeout(do_all_gens.bind(null, remaining_runs), 5);
    } else {
        ++runs_stats[should_stop()-1];
        document.getElementById('runs_stats0').innerHTML = "x convergence: " + runs_stats[0];
        document.getElementById('runs_stats1').innerHTML = "y convergence: " + runs_stats[1];
        document.getElementById('runs_stats2').innerHTML = "premature convergence: " + runs_stats[2];
        document.getElementById('runs_stats3').innerHTML = "exceeded # gens: " + runs_stats[3];
        current_generation = null;
        //console.log("calling " + (remaining_runs-1));
        setTimeout(do_all_gens.bind(null, remaining_runs-1), 5);
    }
}
function do_many_runs() {
    do_all_gens(amount_runs);
}

function clear_stats() {
    runs_stats = [0,0,0,0];
}

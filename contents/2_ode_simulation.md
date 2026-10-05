# 第2回　常微分方程式と数値シミュレーション

### 今回の位置付け

1. 現象の理解
2. 仮定の設定
3. 数理モデルの構築
4. <span style="color:red">数値シミュレーション</span>
5. データとの比較
6. パラメタ推定
7. モデルの検証と改善

- 第1回：現象について仮定を置き，それを微分方程式（変化率の式）として記述した．
- 第2回：ワークフローの4段階目である数値シミュレーションを扱う．
- **数値シミュレーション**：微分方程式が与えられたとき，計算機で状態変数の時間変化を求める方法

微分方程式の中には指数関数などを用いて解を明示的な数式で表せるものがあり，解析的な計算によって得られる解を**解析解**と呼ぶ．
一方で現実問題に適用されるような複雑なモデルでは解を明示的に表すことが困難な場合がある．
その場合の処方箋として，離散的な時刻における解の近似値である**数値解**を計算し，状態変数の時間変化を調べる．

### 到達目標

- 初期値問題 $x' = f(t, x)$，$x(t_0) = x_0$ の解が，微分方程式と初期条件の両方を満たす関数であることを説明できる
- Euler法の更新式 $x_{k+1}=x_k+h f(t_k,x_k)$ の意味を説明し，手計算で数ステップ実行できる
- Euler法をPythonで実装し，刻み幅を変えると誤差と計算量がどう変わるかを表と図で示せる
- `scipy.integrate.solve_ivp`を使って初期値問題を解き，結果を解析解やEuler法と比較できる
- 数値解が得られたことと，モデルが現実に合うことが別問題であることを，人口データを使って説明できる

<!--
**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第1回の復習，解析解を明示することが困難な微分方程式の例（演習0） | 10分 |
| 2 | 初期値問題，Euler法の導出と手計算（演習1） | 25分 |
| 3 | Euler法の実装，刻み幅と誤差，`solve_ivp`の使い方 | 20分 |
| 4 | 刻み幅の比較，減衰モデル，人口データとの比較（演習2〜4） | 35分 |
| 5 | 数値解と現実の違いの共有，まとめ，課題の説明 | 15分 |
 -->

### 前回の復習と今回の位置付け

第1回では，1年あたりの増加量が現在の状態変数の値に比例するという仮定を，次の差分方程式で表した．

$$
x_{k+1} = x_k + r\,x_k \qquad (\Delta t = 1\ \text{年})
$$

そして，$\Delta t$ を細かくした極限として微分方程式 $x' = rx$ を得た．
今回はこの手順を逆にたどる．
微分方程式 $x' = rx$ から出発し，適当な刻み幅 $h$ で

$$
x_{k+1} = x_k + h\,r\,x_k
$$

と計算する．この問題では，固定した有限の計算区間で $h \to 0$ とすると，丸め誤差を除いたEuler法の近似値は微分方程式の解に収束する．
第1回の計算は，$h = 1$ 年としたこの手順の特別な場合だったことになる．

### なぜ数値的に解く必要があるのか

$x' = rx$ の解は $x(t) = x_0 e^{rt}$ と書ける．
しかし，仮定を少し現実的にするだけで，解の式は簡単には求まらなくなる．

| 仮定 | 微分方程式 | 解析的な計算の方法と制約（初期時刻は0） |
| --- | --- | --- |
| 変化率が現在量に比例する | $x' = rx$ | $x_0 e^{rt}$ |
| 一人あたりの増加率が人口に対して線形に減少する（第4回） | $x' = rx(1 - x/K)$ | 変数分離により解析解を求められる |
| 増加率が周期的に変化する（第9回で扱う周期入力の関連例） | $x' = r(1 + \sin(2\pi t/T))\,x$，$T$ は周期 | 変数分離により解析解を求められる |
| 流入量と放流量を観測データで与える（第6回） | $V' = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}(t)$ | 入力を補間し，その時間積分を計算する |
| 捕食によって2つの個体群が相互作用する（第10回） | $x' = ax - bxy$，$y' = -cy + dxy$ | 一般の初期条件に対して，時間の関数としての解を初等関数で表すことは困難である |

観測データを入力とするモデルや連立微分方程式にも共通の手順で対応するため，微分方程式から解の近似値を計算する方法を学ぶ．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第2回の作業フォルダを作成する．データフォルダは第1回と同様に`~/applied_programming_ii/data`をそのまま使う．

```bash
mkdir -p ~/applied_programming_ii/02
cd ~/applied_programming_ii/02
mkdir -p notebooks reports/figures
```

2. `notebooks/ode_simulation.ipynb`を新規作成する．

3. `02`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第2回

- 氏名：
- 学籍番号：

## 今日の目標

Euler法の原理を説明し，Pythonで初期値問題を数値計算して解析解と比較する．

## 計算条件

- 微分方程式：dx/dt = r x
- パラメタ：r = 0.2 /日
- 初期値：x(0) = 100 g
- 計算区間：0〜10日

## 演習1：手計算の記録

## 演習2：刻み幅と誤差の表

| 刻み幅 h | ステップ数 | x(10)の数値解 | 解析解 | 誤差 |
| --- | --- | --- | --- | --- |

## 演習3・4の記録

## 課題1

## 課題2の考察
```

4. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．今回から`scipy`を使う．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp

import scipy
print("NumPy:", np.__version__)
print("SciPy:", scipy.__version__)

PROJECT_DIR = Path.home() / "applied_programming_ii" / "02"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
```
````

## 初期値問題

### 定義

時間 $t$ とともに変わる状態変数 $x(t)$ について，

$$
\frac{dx}{dt} = f(t, x),
\qquad
x(t_0) = x_0
$$

をともに満たす関数 $x(t)$ を求める問題を**初期値問題**と呼ぶ．
1つ目の式が微分方程式，2つ目の式が初期条件である．

- $f(t, x)$ は，時刻 $t$ に状態が $x$ であるときの変化率を与える関数である．状態の変化に関する仮定を $f$ の関数形で表す
- $x_0$ は，初期時刻 $t_0$ における状態変数の値である

微分方程式だけでは解は1つに決まらない．
$x' = rx$ を満たす関数は $x_0$ の値ごとに無数にある．
この方程式では，初期条件を与えると解が一意に定まる．一般の $f$ についても，$f$ が連続で $x$ に関して局所Lipschitz連続であるなどの十分条件の下では，初期時刻の近傍で解の存在と一意性が保証される．
微分方程式は各時刻・状態における変化率を規定し，初期条件は特定の時刻における状態を指定する．

### 例：指数的な増加と減衰

$f(t, x) = rx$ の場合，初期値問題の解は

$$
x(t) = x_0\,e^{r(t - t_0)}
$$

である．
$x_0>0$ のとき，$r>0$ なら増加，$r<0$ なら0への減衰，$r=0$ なら一定値を表す．
減衰の例には，薬物の血中濃度，放射性物質の量，室温との温度差などがある．

````{dropdown} 補足：解析解が初期値問題を満たすことの確認

$x(t) = x_0 e^{r(t - t_0)}$ を $t$ で微分すると，

$$
\frac{dx}{dt} = x_0\,r\,e^{r(t - t_0)} = r\,x(t)
$$

となり，微分方程式を満たす．
また $t = t_0$ を代入すると $x(t_0) = x_0 e^{0} = x_0$ で，初期条件も満たす．

この講義では，解析解が分かる場合は，数値解が正しく計算できているかを確かめる基準として使う．
````

この解析解をPythonの関数として用意しておく．
この関数の値を基準として数値解の誤差を評価する．以下では数値解から解析解を引いた符号付きの誤差と，その絶対値を区別する．

```python
def exponential_solution(t, x0, r, t0=0.0):
    """dx/dt = r x, x(t0) = x0 の解析解 x0 * exp(r (t - t0)) を返す．"""
    return x0 * np.exp(r * (t - t0))
```

## Euler法：解の一次近似による時間発展の計算

### 導出

微分の定義から，刻み幅 $h$ が小さいとき

$$
x'(t) \approx \frac{x(t + h) - x(t)}{h}
$$

である．
これを $x(t + h)$ について解くと，

$$
x(t + h) \approx x(t) + h\,x'(t) = x(t) + h\,f(t, x(t))
$$

となる．
右辺は，時刻 $t$ の値と傾きだけから計算できる．
区間内の変化率を区間始点の値で近似し，その値と刻み幅の積を現在の値に加える操作である．

時刻を $t_k = t_0 + kh$，そのときの近似値を $x_k$ と書くと，**Euler法**は次の繰り返しになる．

$$
x_{k+1} = x_k + h\,f(t_k, x_k),
\qquad k = 0, 1, 2, \ldots
$$

初期値 $x_0$ から更新式を逐次適用し，各時刻の近似値を計算する．
第1回の漸化式 $x_{k+1} = x_k + r x_k$ は，$f(t, x) = rx$，$h = 1$ の場合にほかならない．

```{tip} Euler法の誤差はどこから来るか
Euler法は，$t_k$ から $t_{k+1}$ までの間，傾きが $f(t_k, x_k)$ のまま変わらないと見なしている．
解が十分滑らかな場合，厳密な値から1ステップだけ計算したときの誤差は $O(h^2)$ である．この近似誤差が各ステップで伝播する．
安定に計算できる十分小さい刻み幅では，固定した有限区間での大域誤差は $O(h)$ となる．したがって，丸め誤差を無視すれば，刻み幅の縮小によって誤差を減らせるが，ステップ数は増加する．
ここで $O(h^p)$ は，十分小さい $h$ に対して誤差の大きさが定数倍の $h^p$ 以下となることを表す．次の節で刻み幅と誤差の関係を数値的に確かめる．
```

### 手計算で確かめる

$x' = 0.2\,x$，$x(0) = 100$ を刻み幅 $h = 1$ で3ステップ計算する．

| $k$ | $t_k$ | $x_k$ | 傾き $f(t_k, x_k) = 0.2\,x_k$ | $x_{k+1} = x_k + 1 \times 0.2\,x_k$ |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 100 | 20 | 120 |
| 1 | 1 | 120 | 24 | 144 |
| 2 | 2 | 144 | 28.8 | 172.8 |
| 3 | 3 | 172.8 | | |

解析解は $x(3) = 100\,e^{0.6} = 182.21$ であり，Euler法の値172.8は約9.4小さい．
傾きを区間の始めの値で固定したために，増え方を過小に見積もっている．

````{note} 演習1：刻み幅を半分にして手計算する

同じ問題を刻み幅 $h = 0.5$ で $t = 2$ まで（4ステップ）手計算し，`README.md`の「演習1」に表を書く．
電卓を使ってよい．

1. $t = 2$ での値を，$h = 1$ のときの値144と，解析解 $100\,e^{0.4} = 149.18$ と比べる．
2. 刻み幅を半分にすると，誤差はおよそ何分の1になったか．
````

```{dropdown} 演習1の確認
$h = 0.5$ では，各ステップで $x_{k+1} = x_k + 0.5 \times 0.2\,x_k = 1.1\,x_k$ となる．
$100 \to 110 \to 121 \to 133.1 \to 146.41$ で，$t = 2$ の値は146.41である．
誤差は $149.18 - 146.41 = 2.77$ で，$h = 1$ のときの誤差 $149.18 - 144 = 5.18$ のおよそ半分である．
このように，Euler法では十分小さい刻み幅の範囲で，刻み幅を半分にすると大域誤差もおよそ半分になる．
```

## Pythonによる実装

### Euler法の関数

手計算の手順をそのまま関数にする．
右辺の関数 $f$，計算区間，初期値，刻み幅を引数で与え，時刻の配列と近似解の配列を返す．

```python
def euler(rhs, t_span, x0, h, args=()):
    """前進Euler法で初期値問題 x' = rhs(t, x, *args), x(t0) = x0 を解く．

    rhs: 右辺の関数．rhs(t, x, *args) の形で呼び出す．
    t_span: (t0, t_end) 計算区間．
    x0: 初期値．
    h: 刻み幅．
    args: rhs に渡すパラメタのタプル．
    戻り値: 時刻の配列 t と近似解の配列 x．
    """
    t0, t_end = t_span
    n_steps = int(round((t_end - t0) / h))
    t = t0 + h * np.arange(n_steps + 1)
    x = np.zeros(n_steps + 1)
    x[0] = x0
    for k in range(n_steps):
        x[k + 1] = x[k] + h * rhs(t[k], x[k], *args)
    return t, x
```

右辺の関数は，`solve_ivp`と同じ`rhs(t, x, パラメタ...)`の形で書く．
今回のモデルではパラメタは $r$ の1つである．

```python
def exponential_rhs(t, x, r):
    """dx/dt = r x の右辺．"""
    return r * x
```

### 解析解との比較

ここでは $x(0)=100$，$r=0.2$／日，計算区間0〜10日として計算する．
状態変数の単位は g，時間の単位は日とする．

```python
# パラメタ
r = 0.2          # 増加率 [1/日]

# 初期条件と計算区間
x0 = 100.0       # 初期値 [g]
t_span = (0.0, 10.0)   # 0日から10日まで

# 刻み幅を変えて計算する
h_values = [1.0, 0.5, 0.1, 0.01]

print(f"{'h':>6} {'ステップ数':>8} {'x(10)の数値解':>14} {'解析解':>10} {'誤差':>10}")
for h in h_values:
    t, x = euler(exponential_rhs, t_span, x0, h, args=(r,))
    exact_end = exponential_solution(t[-1], x0, r)
    error = x[-1] - exact_end
    print(f"{h:6.2f} {len(t) - 1:8d} {x[-1]:14.2f} {exact_end:10.2f} {error:10.2f}")
```

刻み幅を1/10にすると誤差もおよそ1/10になる一方，ステップ数は10倍になる．
精度と計算量は引き換えの関係にある．

```python
t_fine = np.linspace(t_span[0], t_span[1], 201)
x_exact = exponential_solution(t_fine, x0, r)

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(t_fine, x_exact, color="black", label="analytical solution")
for h, marker in zip([1.0, 0.5, 0.1], ["o", "s", "^"]):
    t, x = euler(exponential_rhs, t_span, x0, h, args=(r,))
    ax.plot(t, x, marker=marker, markersize=4, linestyle="--", label=f"Euler, h = {h}")
ax.set_title("Euler method vs. analytical solution (dx/dt = 0.2 x)")
ax.set_xlabel("Time [day]")
ax.set_ylabel("x [g]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "euler_vs_exact.png", dpi=150)
plt.show()
```

Euler法の曲線は，どの刻み幅でも解析解の下側にある．
今回の指数成長の解は $x''(t)=r^2x(t)>0$ を満たし，区間内で増加する変化率を区間始点の値で近似するためである．

````{note} 演習2：刻み幅と誤差の関係を表にする

1. 上の表の結果を`README.md`の「演習2」の表に転記する．
2. `h_values`に`2.0`と`5.0`を追加して実行する．刻み幅が大きいとき，数値解はどうなるか．
3. `h_values`に`0.001`を追加して実行し，誤差とステップ数を記録する．刻み幅を1/10にしたとき，誤差はおよそ何分の1になるか．
4. 誤差を10分の1にするには計算量を何倍にする必要があるか，表から見積もる．
````

## `solve_ivp`による数値シミュレーション

### 使い方

Euler法は原理が分かりやすいが，精度を上げるには非常に小さい刻み幅が必要になる．
実際の計算では，`scipy.integrate.solve_ivp`を使う．
この関数は，既定ではRunge–Kutta法の一種であるRK45を使い，各ステップの局所誤差の推定値に基づいて刻み幅を自動調整する．許容誤差は局所誤差の制御に用いられ，計算区間全体の誤差の上限を保証するものではない．`t_eval`は出力時刻を指定する引数であり，内部の刻み幅を直接指定するものではない．
導出はこの講義では扱わない．

基本の呼び出し方は次のとおりである．

```python
# 数値解を出力したい時刻
t_eval = np.linspace(t_span[0], t_span[1], 101)

sol = solve_ivp(exponential_rhs, t_span, [x0], t_eval=t_eval, args=(r,))

print("成功したか:", sol.success)
print("時刻の配列の形:", sol.t.shape)
print("解の配列の形:", sol.y.shape)
print("右辺を評価した回数:", sol.nfev)
```

引数と戻り値の対応を整理する．

| 引数・属性 | 意味 | 今回の値 |
| --- | --- | --- |
| 第1引数 | 右辺の関数 `rhs(t, x, *args)` | `exponential_rhs` |
| 第2引数 `t_span` | 計算区間 $(t_0, t_{\mathrm{end}})$ | `(0.0, 10.0)` |
| 第3引数 | 初期値．状態変数が1つでもリストで渡す | `[x0]` |
| `t_eval` | 解を出力する時刻の配列 | `np.linspace(0, 10, 101)` |
| `args` | 右辺に渡すパラメタのタプル | `(r,)` |
| `sol.t` | 出力時刻の配列 | 長さ101 |
| `sol.y` | 解の配列．行が状態変数，列が時刻 | 形は (1, 101) |
| `sol.y[0]` | 1つ目の状態変数の時系列 | $x(t)$ |

状態変数が1つでも`sol.y`は2次元配列になる．
$x(t)$ を取り出すには`sol.y[0]`と書く．
第10回で状態変数が2つになると，`sol.y[0]`と`sol.y[1]`を使う．

### Euler法および解析解との比較

```python
x_ivp = sol.y[0]
x_exact_eval = exponential_solution(sol.t, x0, r)

print(f"solve_ivp の x(10) = {x_ivp[-1]:.4f}")
print(f"解析解の x(10)     = {x_exact_eval[-1]:.4f}")
print(f"誤差               = {x_ivp[-1] - x_exact_eval[-1]:.4f}")
print(f"最大誤差（全時刻） = {np.max(np.abs(x_ivp - x_exact_eval)):.4f}")

t_euler, x_euler = euler(exponential_rhs, t_span, x0, 0.01, args=(r,))
print(f"Euler法 h=0.01 の x(10) = {x_euler[-1]:.4f}，ステップ数 = {len(t_euler) - 1}")
```

`solve_ivp`は，右辺を数十回評価するだけで，Euler法が1000ステップかけた結果と同程度以上の精度を出す．
以後の講義では，特に断らない限り`solve_ivp`を使う．
Euler法は，数値解法が何をしているかを理解するための基準として覚えておく．

```{tip} 許容誤差の指定
`solve_ivp`の既定の相対許容誤差は`rtol=1e-3`である．
もっと高い精度が必要なときは`solve_ivp(..., rtol=1e-8, atol=1e-10)`のように指定する．
精度を上げるほど右辺の評価回数は増える．
必要な精度を満たすかは，解析解との比較や，許容誤差を小さくした再計算によって確認する．許容誤差と出力時刻の定義は[SciPy公式ドキュメント](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html)も参照すること．
```

````{note} 演習3：減衰モデルを solve_ivp で解く

薬を服用した後の血中濃度のように，現在量に比例して減る現象を考える．

$$
\frac{dx}{dt} = -k\,x,
\qquad x(0) = 100
$$

$k = 0.3$ /時間，計算区間を0〜24時間とする．

1. 右辺の関数`decay_rhs(t, x, k)`を定義する．
2. `solve_ivp`で解き，解析解 $100\,e^{-kt}$ と同じ図に描く．軸ラベルに単位を付ける．
3. 濃度が初期値の半分になる時刻（半減期）を，数値解の配列から読み取る．解析解から求めた $\ln 2 / k$ と比べる．
4. $k$ を`0.1`と`0.6`に変え，半減期がどう変わるかを記録する．
````

````{dropdown} 演習3の確認：コード例

```python
def decay_rhs(t, x, k):
    """dx/dt = -k x の右辺．"""
    return -k * x


k = 0.3                      # 減衰率 [1/時間]
x0_decay = 100.0             # 初期濃度 [任意単位]
t_span_decay = (0.0, 24.0)   # 0〜24時間
t_eval_decay = np.linspace(0.0, 24.0, 241)

sol_decay = solve_ivp(decay_rhs, t_span_decay, [x0_decay], t_eval=t_eval_decay, args=(k,))
x_decay = sol_decay.y[0]
x_decay_exact = x0_decay * np.exp(-k * sol_decay.t)

# 半減期：数値解が初期値の半分を下回る最初の時刻
idx_half = np.argmax(x_decay <= 0.5 * x0_decay)
print(f"数値解から読んだ半減期: {sol_decay.t[idx_half]:.2f} 時間")
print(f"解析解の半減期 ln2/k:  {np.log(2) / k:.2f} 時間")

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(sol_decay.t, x_decay_exact, color="black", label="analytical solution")
ax.plot(sol_decay.t, x_decay, linestyle="--", label="solve_ivp")
ax.axhline(0.5 * x0_decay, color="gray", linestyle=":", label="half of initial value")
ax.set_title("Exponential decay (dx/dt = -0.3 x)")
ax.set_xlabel("Time [hour]")
ax.set_ylabel("Concentration [arbitrary unit]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "decay_solve_ivp.png", dpi=150)
plt.show()
```

半減期は $\ln 2 / 0.3 = 2.31$ 時間である．
上のコードのように濃度が50以下となる最初の出力時刻を選ぶと，0.1時間間隔の出力では2.4時間となる．この読み取りには出力時刻の離散化による誤差も含まれる．
$k$ を2倍にすると半減期は半分になる．
````

## オープンデータとの比較：数値計算の精度とモデルの妥当性

第1回で使った人口データに，指数成長モデル $N' = rN$ を`solve_ivp`で当ててみる．
時間の単位は年，$t = 0$ を1920年とする．
$r$ は第1回と同様に1920年と1970年の値から決めるが，今回は微分方程式の解 $N_0 e^{rt}$ に合わせて $r = \ln(N_{1970}/N_{1920}) / 50$ とする．

```python
population = pd.read_csv(DATA_DIR / "population_japan.csv")
population["population_10k"] = population["total_population_thousand"] / 10

year0 = 1920
n_1920 = float(population.loc[population["year"] == 1920, "population_10k"].iloc[0])
n_1970 = float(population.loc[population["year"] == 1970, "population_10k"].iloc[0])
r_pop = np.log(n_1970 / n_1920) / (1970 - 1920)
print(f"r = {r_pop:.5f} /年")

t_eval_pop = np.arange(0, 101)          # 1920年から2020年まで [年]
sol_pop = solve_ivp(exponential_rhs, (0, 100), [n_1920], t_eval=t_eval_pop, args=(r_pop,))
n_model = sol_pop.y[0]
n_exact = exponential_solution(sol_pop.t, n_1920, r_pop)

print(f"数値解と解析解の最大差: {np.max(np.abs(n_model - n_exact)):.3f} 万人")
```

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(population["year"], population["population_10k"], color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(year0 + sol_pop.t, n_model, label=f"exponential model, solve_ivp (r = {r_pop:.4f})")
ax.axvline(1970, color="gray", linestyle=":", label="end of fitting period")
ax.set_title("Exponential growth model vs. observed population of Japan")
ax.set_xlabel("Year")
ax.set_ylabel("Population [10^4 persons]")
ax.set_ylim(0, 20000)
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "population_exponential_solve_ivp.png", dpi=150)
plt.show()
```

数値解と解析解の差は最大でも1万人未満であり，観測値との差（数千万人）に比べれば無視できる．`solve_ivp`はこのモデルを十分正確に解いている．
それでも，1970年以降の曲線は観測値から大きく外れる．
この比較から，数値計算の誤差だけでは観測値との差を説明できないと判断できる．増加率を一定としたモデルの仮定や，パラメタを決めた期間を検討する必要がある．

````{note} 演習4：数値誤差と観測値に対する残差を区別する

1. Euler法を刻み幅 $h = 10$ 年で同じモデルに適用し，`solve_ivp`の結果と同じ図に重ねる．
2. 数値解と解析解の差，および解析解と観測値の差をそれぞれ指摘し，両者の意味を`README.md`に書く．
3. 刻み幅を $h = 1$ 年にすると，どちらの差が小さくなるか．どちらは変わらないか．
````

```{tip} 誤差の種類を区別する
数値解と観測値の差には，少なくとも2つの原因がある．
1つは数値解法の誤差で，刻み幅や許容誤差を変えれば小さくできる．
もう1つはモデルの仮定による誤差で，どれだけ精密に計算しても消えない．
計算を精密にすれば現実に合うようになる，というのは誤解である．
第12回では，これに観測の誤差とパラメタ推定の誤差を加えた4種類を整理する．
```

## 発展：刻み幅が大きすぎると何が起きるか

減衰モデル $x' = -kx$ をEuler法で解くと，更新式は $x_{k+1} = (1 - hk)\,x_k$ になる．
$hk > 2$ のとき $|1 - hk| > 1$ となり，数値解は符号を変えながら発散する．
本来は単調に減るはずの解が，計算の仕方のせいで振動して増えてしまう．

````{dropdown} 発展演習：Euler法の不安定性

```python
k = 2.0
x0_decay = 100.0
t_span_decay = (0.0, 10.0)

fig, ax = plt.subplots(figsize=(7, 4))
t_fine = np.linspace(0.0, 10.0, 201)
ax.plot(t_fine, x0_decay * np.exp(-k * t_fine), color="black", label="analytical solution")
for h in [0.4, 0.9, 1.2]:
    t, x = euler(decay_rhs, t_span_decay, x0_decay, h, args=(k,))
    ax.plot(t, x, marker="o", markersize=3, linestyle="--", label=f"Euler, h = {h} (hk = {h * k:.1f})")
ax.set_title("Euler method for dx/dt = -2 x with large step sizes")
ax.set_xlabel("Time [arbitrary unit]")
ax.set_ylabel("x [arbitrary unit]")
ax.set_ylim(-300, 300)
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "euler_instability.png", dpi=150)
plt.show()
```

1. $hk < 1$，$1 < hk < 2$，$hk > 2$ の3つの場合で数値解の振舞いがどう違うかを説明する．
2. 同じ問題を`solve_ivp`で解き，解析解との絶対誤差を評価する．
3. 減衰が速い（$k$ が大きい）現象ほど，Euler法では小さい刻み幅が必要になる理由を説明する．
````

この現象は数値解法の**安定性**の問題であり，刻み幅を選ぶときの注意点として知っておくとよい．
`solve_ivp`も数値解法であるため，計算の成功・失敗と，許容誤差を変更したときの結果の変化を確認する必要がある．

## モデルの限界と改善の問い

今回の内容は計算の道具に関するものだが，道具にも限界がある．

- Euler法は刻み幅を小さくしないと精度が出ない．`solve_ivp`はこの問題を大幅に軽減するが，右辺の関数が滑らかでない場合（観測データを補間して使う第6回など）には注意が必要である
- 数値解が精密に求まっても，モデルの仮定が現象に合っていなければ観測値とは一致しない．人口データの例がそれを示している
- 逆に，観測値とよく合っていても，数値解法の誤差とモデルの誤差が偶然打ち消し合っている可能性もある．解析解が分かる場合や刻み幅を変えた場合と比べて，数値解自体の妥当性を確かめる習慣が必要である

## 課題

````{warning} 課題1：減衰モデルの数値解と解析解の比較

$x' = -kx$，$x(0) = 100$，$k = 0.3$ /時間，計算区間0〜24時間について，次を行う．

1. Euler法を刻み幅 $h = 2, 1, 0.5, 0.1$ 時間で実行し，$t = 24$ での数値解，解析解，誤差，ステップ数を表にする．
2. `solve_ivp`の結果を同じ表に加える（ステップ数の代わりに`sol.nfev`を書く）．
3. 解析解，Euler法（$h = 2$ と $h = 0.1$），`solve_ivp`を1枚の図に描き，`reports/figures/`に保存する．線種とマーカーを変え，凡例と単位付きの軸ラベルを付ける．
4. 表と図から，Euler法と`solve_ivp`の精度と計算量の違いを3行程度で説明する．
````

````{warning} 課題2：数値解が得られることと現実に合うことの違い

「オープンデータとの比較」の図を使って，次の問いに200字程度で答える．

指数成長モデルの数値解は，解析解との差が1万人未満であるにもかかわらず，2020年の観測値とは数千万人の差がある．
数値解と解析解の差，および解析解と観測値の差は，それぞれどのような要因によって生じるか．
また，2020年の観測値に近づけるために，計算方法を変えるべきか，モデルを変えるべきか．
理由とともに述べる．

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

### 提出先・期限

HOGEHOGE（`README.md`とNotebookをまとめて，WebClassに提出する．10月9日23:59「第2回課題」）

## まとめ

- 初期値問題は，微分方程式 $x'=f(t,x)$ と初期条件 $x(t_0)=x_0$ をともに満たす関数を求める問題である
- Euler法は $x_{k+1}=x_k+h f(t_k,x_k)$ により近似値を逐次計算する．十分小さい刻み幅の範囲では，大域誤差は $O(h)$ であり，同じ区間で刻み幅を半分にするとステップ数は2倍になる
- `solve_ivp`は，より高精度な方法と刻み幅の自動調整により，少ない計算量で精度の高い数値解を与える．呼び出し方は`solve_ivp(rhs, t_span, [x0], t_eval=t_eval, args=(パラメタ,))`で，解は`sol.y[0]`に入る
- 数値解と観測値の差には，数値解法の誤差とモデルの仮定による誤差がある．前者は計算を精密にすれば減るが，後者は減らない

## 自主学習用の発展問題

課題1・2を全てこなし，時間が余った場合に取り組んでよい．

````{note} 発展問題1：Runge–Kutta法の導出
HOGEHOGE
````

````{note} 発展問題2：
HOGEHOGE
````


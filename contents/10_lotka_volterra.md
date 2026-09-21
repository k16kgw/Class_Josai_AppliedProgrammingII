# 第10回　生態系と連立微分方程式

## 今回の位置付け

$$
\text{現象の理解}
\rightarrow
\text{仮定の設定}
\rightarrow
\underline{\text{数理モデルの構築}}
\rightarrow
\underline{\text{数値シミュレーション}}
\rightarrow
\text{データとの比較}
\rightarrow
\text{パラメタ推定}
\rightarrow
\text{モデルの検証と改善}
$$

第9回までのモデルは，状態変数が1つだった．
人口 $N$，貯水量 $V$，訪日外客数 $x$ のいずれも，1本の微分方程式で変化率を指定した．
今回は，互いに影響し合う2つの量を同時に追う．
題材は，被食者と捕食者からなる生態系である．
状態変数がベクトルになり，微分方程式が連立になる．
この拡張により，第11回の感染症モデルのように3つ以上の状態変数を持つモデルへ進む準備が整う．

## 今回の到達目標

- 状態変数が1つの場合の初期値問題を，ベクトル値の状態変数を持つ連立微分方程式へ拡張して書ける
- 被食者と捕食者について，各項の符号と積 $xy$ の意味からLotka–Volterraモデルを組み立てられる
- `solve_ivp`で連立系を解き，時系列と相平面の両方を描ける
- 初期値とパラメタを変えたとき，周期，振幅，位相差がどう変わるかを説明できる
- 毛皮の取引記録という観測量と，個体数という状態変数の関係を仮定として明示し，モデルの当てはめと限界を議論できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第9回の復習，被食者と捕食者の時系列の観察（演習0） | 10分 |
| 2 | ベクトル値の状態変数，各項の符号と $xy$ からのモデル構築 | 25分 |
| 3 | `solve_ivp`による連立系の実装，時系列と相平面 | 20分 |
| 4 | 初期値とパラメタの変更，データとの比較（演習1〜4） | 35分 |
| 5 | 不足している要因の共有，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

これまでの初期値問題は

$$
\frac{dx}{dt} = f(t, x), \qquad x(t_0) = x_0
$$

という形で，$x$ は1つの数だった．
状態変数が2つある場合は，2つの量をまとめてベクトル $\boldsymbol{x} = (x, y)$ とし，

$$
\frac{d}{dt}
\begin{pmatrix} x \\ y \end{pmatrix}
=
\begin{pmatrix} f_1(t, x, y) \\ f_2(t, x, y) \end{pmatrix},
\qquad
\begin{pmatrix} x(t_0) \\ y(t_0) \end{pmatrix}
=
\begin{pmatrix} x_0 \\ y_0 \end{pmatrix}
$$

と書く．
$x$ の変化率 $f_1$ が $y$ にも依存し，$y$ の変化率 $f_2$ が $x$ にも依存する点が新しい．
一方が変わると他方の変化率が変わり，それがまた一方に返ってくる．
この相互作用があるため，連立系の解は1変数のモデルでは現れなかった振舞いを示す．

計算の道具は変わらない．
第2回で学んだEuler法も`solve_ivp`も，右辺がベクトルを返すようにするだけでそのまま使える．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第10回の作業フォルダを作成する．

```bash
mkdir -p ~/applied_programming_ii/10
cd ~/applied_programming_ii/10
mkdir -p notebooks reports/figures
```

2. 講義サイトの[授業用データ一覧](../data/README.md)から`lynx_hare_pelts.csv`をダウンロードし，`~/applied_programming_ii/data/`に置く．

3. `notebooks/lotka_volterra.ipynb`を新規作成する．

4. `10`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第10回

- 氏名：
- 学籍番号：

## 今日の目標

被食者と捕食者の連立微分方程式を実装し，時系列と相平面で相互作用を説明する．

## 計算条件

- モデル：Lotka–Volterra
- 状態変数：被食者 x，捕食者 y（単位：千枚，毛皮数に比例すると仮定）
- パラメタ：a = 0.6，b = 0.03，c = 0.9，d = 0.025（単位は本文の表を参照）
- 初期値：x(0) = 40，y(0) = 9
- 計算区間：0〜40年

## 演習1〜4の記録

- 変更した条件：
- 実行前の予想：
- 実行後に分かったこと：

## 課題1

## 課題2の考察
```

5. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．

```python
from pathlib import Path
import itertools

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp

PROJECT_DIR = Path.home() / "applied_programming_ii" / "10"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("毛皮データの有無:", (DATA_DIR / "lynx_hare_pelts.csv").exists())
```
````

## 導入：被食者と捕食者の時系列

カナダの毛皮商社 Hudson's Bay Company は，1845年から1935年にかけて，取引した毛皮の枚数を記録していた．
カンジキウサギ（被食者）とカナダオオヤマネコ（捕食者）の毛皮数は，生態学者 MacLulich と Odum によって整理され，捕食と被食の関係を示す古典的なデータになっている．

```python
pelts = pd.read_csv(DATA_DIR / "lynx_hare_pelts.csv")
print(pelts.head())
print("期間:", pelts["year"].min(), "〜", pelts["year"].max(), " 行数:", len(pelts))

fig, ax = plt.subplots(figsize=(10, 4))
ax.plot(pelts["year"], pelts["hare_pelts_thousand"], color="tab:green", marker="o", markersize=3, label="snowshoe hare (prey)")
ax.plot(pelts["year"], pelts["lynx_pelts_thousand"], color="tab:red", marker="s", markersize=3, label="Canada lynx (predator)")
ax.set_title("Pelts traded by the Hudson's Bay Company, 1845-1935")
ax.set_xlabel("Year")
ax.set_ylabel("Pelts [thousand]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "pelts_observed.png", dpi=150)
plt.show()
```

この図から次のことが読み取れる．

- どちらの量も約10年の周期で増減を繰り返している
- 被食者の山の少し後に捕食者の山が来る．捕食者の山が被食者の山より遅れている
- 山の高さは周期ごとに違い，きれいな繰り返しではない

一定に落ち着くわけでも，指数的に増え続けるわけでもない．
第3回の指数成長モデルや第4回のLogisticモデルは，どちらも時間がたてば一定値か無限大に向かう．
周期的な増減を説明するには，第9回のように外から周期を与えるか，2つの量の相互作用そのものが周期を生むと考えるかのどちらかである．
今回は後者を試す．

```{tip} 観測量は毛皮の枚数であり個体数ではない
このデータは，商社が取引した毛皮の枚数である．
生息している個体数を数えたものではない．
モデルの状態変数を個体数とするなら，「取引された毛皮数は個体数に比例する」という観測モデルの仮定が必要になる．
今回はこの比例定数を単位に吸収し，状態変数を「毛皮数に換算した個体数」として千枚の単位で扱う．
猟の努力量が年によって変われば，この仮定は崩れる．
```

## 数理モデルを作るための仮定

被食者の数を $x$，捕食者の数を $y$ とする．
最も単純な仮定から始める．

**被食者について**

- 仮定1：捕食者がいなければ，被食者は現在量に比例して増える（餌は十分にある）
- 仮定2：被食者が減る速さは，被食者と捕食者の出会いの回数に比例する

**捕食者について**

- 仮定3：被食者がいなければ，捕食者は現在量に比例して減る（餓死する）
- 仮定4：捕食者が増える速さは，被食者と捕食者の出会いの回数に比例する

「出会いの回数」は，被食者が多いほど，捕食者が多いほど増える．
両方に比例すると考えるのが最も単純で，出会いの回数は積 $xy$ に比例すると仮定する．
第3回の $N' = rN$ と同じように，比例という仮定から式が決まる．

## 数式の導出と各項の意味

仮定1から4を式にすると，**Lotka–Volterraモデル**が得られる．

$$
\begin{aligned}
\frac{dx}{dt} &= a\,x - b\,x\,y \\
\frac{dy}{dt} &= -c\,y + d\,x\,y
\end{aligned}
$$

| 項 | 対応する仮定 | 意味 | 符号 | 単位 |
| --- | --- | --- | --- | --- |
| $a\,x$ | 仮定1 | 被食者の自然増加 | 正 | 千枚/年 |
| $-b\,x\,y$ | 仮定2 | 捕食による被食者の減少 | 負 | 千枚/年 |
| $-c\,y$ | 仮定3 | 捕食者の自然減少 | 負 | 千枚/年 |
| $d\,x\,y$ | 仮定4 | 捕食による捕食者の増加 | 正 | 千枚/年 |

パラメタの単位も確認する．

| パラメタ | 意味 | 単位 |
| --- | --- | --- |
| $a$ | 被食者1匹あたり，1年あたりの増加率 | 1/年 |
| $b$ | 捕食者1匹あたりが被食者を減らす率 | 1/(千枚・年) |
| $c$ | 捕食者1匹あたり，1年あたりの減少率 | 1/年 |
| $d$ | 被食者1匹あたりが捕食者を増やす率 | 1/(千枚・年) |

$b\,x\,y$ の単位は $[1/(\text{千枚}\cdot\text{年})] \times [\text{千枚}] \times [\text{千枚}] = [\text{千枚}/\text{年}]$ となり，左辺と一致する．
$b$ と $d$ は同じ単位だが，$d$ が $b$ より小さいのが普通である．
被食者1匹が減ることで，捕食者が1匹分増えるわけではないからである．

### 平衡点

両方の変化率がゼロになる状態を平衡点と呼ぶ．
$x' = 0$ かつ $y' = 0$ を解くと，

$$
(x, y) = (0, 0)
\qquad\text{または}\qquad
(x^*, y^*) = \left(\frac{c}{d}, \frac{a}{b}\right)
$$

の2つが得られる．
2つ目の平衡点では，被食者の数は捕食者のパラメタ $c/d$ で，捕食者の数は被食者のパラメタ $a/b$ で決まる．
直感に反するように見えるが，「捕食者が生き残れるだけの被食者数」と「被食者の増加を打ち消すだけの捕食者数」と読めば納得できる．

````{dropdown} 補足：平衡点の近くでの周期

平衡点 $(x^*, y^*)$ の近くでは，解はその周りを周期

$$
T_{\mathrm{lin}} = \frac{2\pi}{\sqrt{a\,c}}
$$

で回る．
振幅が大きくなると周期はこれより長くなる．
この式は，平衡点の周りで方程式を線形化して得られるが，導出はこの講義では扱わない．
$a = 0.6$，$c = 0.9$ なら $T_{\mathrm{lin}} = 2\pi/\sqrt{0.54} \approx 8.6$ 年である．
````

## Pythonによる最小構成の実装

### 右辺の関数

`solve_ivp`に渡す右辺は，状態ベクトル`state`を受け取り，各成分の変化率をリストで返す．
`state`を`x, y = state`と分解して書くと，数式との対応が分かりやすい．

```python
def lotka_volterra_rhs(t, state, a, b, c, d):
    """Lotka-Volterra モデルの右辺．state = [x, y] の変化率を返す．"""
    x, y = state
    dxdt = a * x - b * x * y
    dydt = -c * y + d * x * y
    return [dxdt, dydt]
```

### 時系列

パラメタと初期値を分けて書き，`solve_ivp`を呼ぶ．
初期値は2成分のリスト，解は`sol.y[0]`が $x$，`sol.y[1]`が $y$ である．

```python
# パラメタ
a = 0.6      # 被食者の増加率 [1/年]
b = 0.03     # 捕食による減少 [1/(千枚・年)]
c = 0.9      # 捕食者の減少率 [1/年]
d = 0.025    # 捕食による増加 [1/(千枚・年)]

# 初期条件と計算区間
x0 = 40.0    # 被食者の初期値 [千枚]
y0 = 9.0     # 捕食者の初期値 [千枚]
t_span = (0.0, 40.0)                # 0〜40年
t_eval = np.linspace(0.0, 40.0, 401)

sol = solve_ivp(lotka_volterra_rhs, t_span, [x0, y0], t_eval=t_eval, args=(a, b, c, d))
x_model = sol.y[0]
y_model = sol.y[1]

print("解の配列の形:", sol.y.shape)
print(f"被食者の最大 {x_model.max():.1f}，最小 {x_model.min():.1f} 千枚")
print(f"捕食者の最大 {y_model.max():.1f}，最小 {y_model.min():.1f} 千枚")
print(f"平衡点 x* = c/d = {c / d:.1f}，y* = a/b = {a / b:.1f} 千枚")
```

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(sol.t, x_model, color="tab:green", label="prey x(t)")
ax.plot(sol.t, y_model, color="tab:red", label="predator y(t)")
ax.axhline(c / d, color="tab:green", linestyle=":", linewidth=1, label="x* = c/d")
ax.axhline(a / b, color="tab:red", linestyle=":", linewidth=1, label="y* = a/b")
ax.set_title("Lotka-Volterra model: time series")
ax.set_xlabel("Time [year]")
ax.set_ylabel("Population (pelt-equivalent) [thousand]")
ax.grid(True)
ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "lv_time_series.png", dpi=150)
plt.show()
```

被食者が増えると捕食者の餌が増え，遅れて捕食者が増える．
捕食者が増えると被食者が減り，餌が減った捕食者も遅れて減る．
被食者が減って捕食者も減ると，被食者は再び増え始める．
この繰り返しが，外から周期を与えなくても周期的な増減を生む．

### 山の時刻と位相差

```python
def peak_times(t, values):
    """時系列の局所的な山の時刻を返す．"""
    is_peak = (values[1:-1] > values[:-2]) & (values[1:-1] > values[2:])
    return t[1:-1][is_peak]


prey_peaks = peak_times(sol.t, x_model)
predator_peaks = peak_times(sol.t, y_model)
print("被食者の山の時刻 [年]:", np.round(prey_peaks, 1))
print("捕食者の山の時刻 [年]:", np.round(predator_peaks, 1))
print(f"周期（被食者の山の間隔）: {np.mean(np.diff(prey_peaks)):.2f} 年")
print(f"捕食者の遅れ（山の時刻の差）: {np.mean(predator_peaks[:len(prey_peaks)] - prey_peaks):.2f} 年")
```

周期は約8.9年，捕食者の山は被食者の山より約1.7年遅れる．
この遅れは，データを見て入れたものではなく，「出会いの回数に比例する」という仮定から自動的に出てきたものである．

### 相平面

時系列の代わりに，横軸に $x$，縦軸に $y$ をとって解の軌跡を描く図を**相平面**と呼ぶ．
時間は図の中に現れないが，軌跡の形から2つの量の関係が一目で分かる．

```python
fig, ax = plt.subplots(figsize=(5.5, 5))
ax.plot(x_model, y_model, color="tab:blue", label="trajectory")
ax.plot(x0, y0, marker="o", color="black", linestyle="none", label="initial state")
ax.plot(c / d, a / b, marker="x", color="tab:red", markersize=10, linestyle="none", label="equilibrium (c/d, a/b)")
ax.set_title("Lotka-Volterra model: phase plane")
ax.set_xlabel("Prey x [thousand]")
ax.set_ylabel("Predator y [thousand]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "lv_phase_plane.png", dpi=150)
plt.show()
```

軌跡は平衡点を囲む閉じた曲線になる．
解は同じ曲線の上を何度も回るので，時系列で見た周期的な変動は，相平面では1本の閉曲線に対応する．
軌跡は反時計回りに進む．
右下（被食者が多く捕食者が少ない）から右上（両方多い），左上（被食者が減り捕食者が多い），左下（両方少ない）を経て右下に戻る．

## パラメタや初期条件を変える演習

````{note} 演習1：初期値を変える

パラメタは固定し，初期値を`(x0, y0)`を`(40, 9)`，`(40, 15)`，`(36, 20)`の3通りに変えて計算する．

1. 3本の軌跡を同じ相平面に描く．軌跡は互いに交わるか．
2. 3通りの周期と，被食者の最大値と最小値の差（振幅）を表にする．初期値を平衡点 $(36, 20)$ に近づけると何が起きるか．
3. 時系列の図で，初期値を変えると曲線の形が変わるか，位置だけが変わるかを観察する．第1回の演習3で指数成長モデルの初期値を変えたときとの違いを述べる．
````

```{dropdown} 演習1の確認
軌跡は交わらず，平衡点を囲む入れ子の閉曲線になる．
平衡点に近い初期値ほど軌跡が小さく，振幅が小さい．
周期は平衡点に近いほど短く，補足で示した $2\pi/\sqrt{ac} \approx 8.6$ 年に近づく．
$(36, 20)$ は平衡点そのものなので，解は動かない．
指数成長モデルでは初期値を変えても曲線が定数倍されるだけだったが，Lotka–Volterraモデルでは初期値によって周期も振幅も変わる．
```

````{note} 演習2：パラメタを変える

初期値は`(40, 9)`に固定し，パラメタを1つずつ変える．

1. `a`を`0.3`と`1.2`にする．被食者の増加率が変わると，周期と平衡点はどう変わるか．
2. `c`を`0.45`と`1.8`にする．捕食者の減少率が変わると，周期と平衡点はどう変わるか．
3. `b`を2倍にする．平衡点のどちらの成分が変わるか．表の $x^* = c/d$，$y^* = a/b$ と照らし合わせる．
4. 各パラメタが「被食者の式」と「捕食者の式」のどちらに入っているかと，平衡点のどちらの成分を動かすかの関係を説明する．
````

## オープンデータとの比較

### 1900年から1920年の期間に当てはめる

毛皮データのうち，山と谷がはっきりしている1900年から1920年の21年間を取り出し，モデルと比べる．
初期値は1900年の観測値とし，パラメタは粗い格子探索で選ぶ．
第5回の方法である．
第7回の最適化を使えばもっと良い値が見つかるが，今回はモデルの形が現象に合っているかを見ることが目的なので，粗い探索で十分である．

```python
window = pelts[(pelts["year"] >= 1900) & (pelts["year"] <= 1920)].reset_index(drop=True)
t_obs = (window["year"] - 1900).values.astype(float)     # 1900年を t = 0 とする [年]
hare_obs = window["hare_pelts_thousand"].values
lynx_obs = window["lynx_pelts_thousand"].values

print(window.head(3).to_string(index=False))
print("観測点の数:", len(window))
```

```python
def mean_squared_error(y_obs, y_model):
    """観測値とモデル値の平均二乗誤差を返す．"""
    return np.mean((y_obs - y_model) ** 2)


# 探索する格子．各パラメタ6通りで 6^4 = 1296 通りのシミュレーションを行う．
a_values = np.arange(0.4, 1.41, 0.2)
b_values = np.arange(0.01, 0.061, 0.01)
c_values = np.arange(0.4, 1.41, 0.2)
d_values = np.arange(0.01, 0.061, 0.01)

results = []
for a_try, b_try, c_try, d_try in itertools.product(a_values, b_values, c_values, d_values):
    sol_try = solve_ivp(lotka_volterra_rhs, (0.0, 20.0), [hare_obs[0], lynx_obs[0]],
                        t_eval=t_obs, args=(a_try, b_try, c_try, d_try))
    if sol_try.y.shape[1] != len(t_obs):
        continue      # 計算が途中で止まった場合は候補から外す
    error = mean_squared_error(hare_obs, sol_try.y[0]) + mean_squared_error(lynx_obs, sol_try.y[1])
    results.append((error, a_try, b_try, c_try, d_try))

results.sort()
print("誤差の小さい上位5組 (誤差, a, b, c, d)")
for row in results[:5]:
    print(np.round(row, 3))

best_error, a_best, b_best, c_best, d_best = results[0]
print(f"\n採用する値: a = {a_best:.2f}, b = {b_best:.3f}, c = {c_best:.2f}, d = {d_best:.3f}")
print(f"平衡点 x* = {c_best / d_best:.1f}, y* = {a_best / b_best:.1f} 千枚")
```

```python
t_dense = np.linspace(0.0, 20.0, 201)
sol_best = solve_ivp(lotka_volterra_rhs, (0.0, 20.0), [hare_obs[0], lynx_obs[0]],
                     t_eval=t_dense, args=(a_best, b_best, c_best, d_best))
sol_best_obs = solve_ivp(lotka_volterra_rhs, (0.0, 20.0), [hare_obs[0], lynx_obs[0]],
                         t_eval=t_obs, args=(a_best, b_best, c_best, d_best))

rmse_hare = np.sqrt(mean_squared_error(hare_obs, sol_best_obs.y[0]))
rmse_lynx = np.sqrt(mean_squared_error(lynx_obs, sol_best_obs.y[1]))
print(f"被食者の RMSE = {rmse_hare:.1f} 千枚，捕食者の RMSE = {rmse_lynx:.1f} 千枚")

fig, (ax_ts, ax_pp) = plt.subplots(1, 2, figsize=(12, 4.5))
ax_ts.plot(1900 + t_obs, hare_obs, color="tab:green", marker="o", linestyle="none", label="hare pelts (observed)")
ax_ts.plot(1900 + t_obs, lynx_obs, color="tab:red", marker="s", linestyle="none", label="lynx pelts (observed)")
ax_ts.plot(1900 + t_dense, sol_best.y[0], color="tab:green", label="prey x(t) (model)")
ax_ts.plot(1900 + t_dense, sol_best.y[1], color="tab:red", label="predator y(t) (model)")
ax_ts.set_title("Lotka-Volterra model vs. Hudson's Bay pelts, 1900-1920")
ax_ts.set_xlabel("Year")
ax_ts.set_ylabel("Pelts / pelt-equivalent [thousand]")
ax_ts.grid(True)
ax_ts.legend(loc="upper right", fontsize=8)

ax_pp.plot(hare_obs, lynx_obs, color="black", marker="o", markersize=3, linewidth=0.8, label="observed")
ax_pp.plot(sol_best.y[0], sol_best.y[1], color="tab:blue", label="model")
ax_pp.set_title("Phase plane")
ax_pp.set_xlabel("Hare [thousand]")
ax_pp.set_ylabel("Lynx [thousand]")
ax_pp.grid(True)
ax_pp.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "lv_fit_pelts.png", dpi=150)
plt.show()
```

モデルは，約10年の周期と「捕食者の山が遅れる」という順序を再現する．
しかし，山の高さは合わないし，1907年に捕食者が急減した点のような細部は全く表せない．
RMSEは被食者で約17千枚，捕食者で約15千枚であり，観測値の振幅（約70千枚）に対して小さくない．

````{note} 演習3：当てはめの結果を読む

1. 相平面の図で，観測値の軌跡とモデルの軌跡はどこが似ていて，どこが違うか．
2. 格子探索の上位5組を見ると，誤差がほぼ同じでもパラメタの組が違う．これは第5回で学んだ何という性質か．
3. 初期値を1900年の観測値に固定したが，観測値には誤差がある．初期値も探索の対象に加えると，何が良くなり，何が難しくなるか．
4. 探索範囲を変えて（例えば`a_values`を`np.arange(0.2, 2.01, 0.2)`），最良の組が範囲の端に来ていないか確認する．端に来ている場合，何を意味するか．
````

### 観測モデルの仮定を見直す

「毛皮数は個体数に比例する」という仮定は，猟師の数や毛皮の価格が一定であれば成り立つ．
しかし，1900年代初頭の毛皮取引は経済状況に左右された．
1907年のカナダオオヤマネコの急減は，個体数の変化ではなく，取引や記録の事情による可能性がある．
観測量の変化を，すべて状態変数の変化と解釈してはならない．
第6回のダムの貯水位と同じく，観測量と状態変数の対応関係そのものが，モデルの一部である．

## モデルの限界と改善の問い

Lotka–Volterraモデルは相互作用が周期を生む仕組みを示すが，実際の生態系に対しては単純すぎる．
不足している要因の例を挙げる．

| 不足している要因 | 現実の状況 | 式への入れ方の例 |
| --- | --- | --- |
| 環境収容力 | 捕食者がいなくても被食者は無限には増えない | 被食者の増加を $a\,x\,(1 - x/K)$ にする |
| 季節性 | 出生は春に集中し，冬は死亡が増える | $a$ を第9回の周期関数 $a(t)$ にする |
| 捕食の飽和 | 被食者が多くても，捕食者1匹が食べられる量には上限がある | $b\,x\,y$ を $\dfrac{b\,x\,y}{1 + h\,x}$ にする |
| 別の餌や捕食者 | オオヤマネコはウサギ以外も食べ，ウサギは他の動物にも食われる | 第3の状態変数を加える |
| 猟による捕獲 | 毛皮の取引自体が個体数を減らす | 捕獲項 $-q\,x$，$-q\,y$ を加える |

このうち環境収容力を入れると，解の性質が変わる．
閉曲線の上を回り続ける代わりに，解は平衡点に向かって渦を巻きながら収束する．

````{dropdown} 発展演習：被食者にLogistic項を加える

```python
def lotka_volterra_logistic_rhs(t, state, a, b, c, d, K):
    """被食者に環境収容力 K を持たせた Lotka-Volterra モデルの右辺．"""
    x, y = state
    dxdt = a * x * (1 - x / K) - b * x * y
    dydt = -c * y + d * x * y
    return [dxdt, dydt]


K = 150.0     # 被食者の環境収容力 [千枚]
t_eval_long = np.linspace(0.0, 80.0, 801)
sol_logistic = solve_ivp(lotka_volterra_logistic_rhs, (0.0, 80.0), [x0, y0],
                         t_eval=t_eval_long, args=(a, b, c, d, K))

x_star = c / d
y_star = (a / b) * (1 - x_star / K)
print(f"新しい平衡点 x* = {x_star:.1f}, y* = {y_star:.1f} 千枚")
print(f"80年後の値   x = {sol_logistic.y[0][-1]:.1f}, y = {sol_logistic.y[1][-1]:.1f} 千枚")

fig, (ax_ts, ax_pp) = plt.subplots(1, 2, figsize=(12, 4.5))
ax_ts.plot(sol_logistic.t, sol_logistic.y[0], color="tab:green", label="prey x(t)")
ax_ts.plot(sol_logistic.t, sol_logistic.y[1], color="tab:red", label="predator y(t)")
ax_ts.set_title(f"Prey with carrying capacity K = {K:.0f}: time series")
ax_ts.set_xlabel("Time [year]")
ax_ts.set_ylabel("Population [thousand]")
ax_ts.grid(True)
ax_ts.legend()
ax_pp.plot(sol_logistic.y[0], sol_logistic.y[1], color="tab:blue")
ax_pp.plot(x_star, y_star, marker="x", color="tab:red", markersize=10, linestyle="none", label="equilibrium")
ax_pp.set_title("Phase plane")
ax_pp.set_xlabel("Prey x [thousand]")
ax_pp.set_ylabel("Predator y [thousand]")
ax_pp.grid(True)
ax_pp.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "lv_logistic_prey.png", dpi=150)
plt.show()
```

1. $K$ を`50`，`150`，`1000`に変え，平衡点への収束の速さと，$K$ が大きいときの振舞いがLotka–Volterraモデルに近づくことを確認する．
2. 環境収容力を入れると振動が減衰する．しかし毛皮データの振動は90年間続いている．このことから，実際の生態系について何が言えるか．
3. 日本の例として，環境省は「全国のニホンジカ及びイノシシの個体数推定等の結果について」（令和3年度）の資料2で，本州以南のニホンジカ推定個体数の推移（1989〜2020年度）をグラフで公表している．数値表は公開されていないため，グラフから中央値を読み取り，捕獲数を捕獲項とするLogisticモデル $N' = rN(1 - N/K) - H(t)$ を当てはめる計画を立てる．必要な仮定，読み取り誤差の扱い，推定するパラメタを`README.md`に書く．
````

```{tip} 単純なモデルの価値
Lotka–Volterraモデルは現実の生態系をそのまま表すには単純すぎる．
それでも，「相互作用だけで周期が生まれる」「捕食者の山は必ず遅れる」「平衡点が相手のパラメタで決まる」という3つの性質は，複雑なモデルにも引き継がれる．
複雑にする前に，単純なモデルが何を説明し，何を説明できないかを確かめておくことが，第12回で扱うモデルの検証の出発点になる．
```

## まとめ

- 状態変数が2つ以上あるモデルは，ベクトル値の状態変数を持つ連立微分方程式として書く．`solve_ivp`は，右辺がリストを返し，初期値をリストで渡せばそのまま使える
- Lotka–Volterraモデルは，「相手がいないときの増減は現在量に比例する」「相互作用は出会いの回数，すなわち積 $xy$ に比例する」という4つの仮定から組み立てられる
- 相互作用だけで周期的な増減が生まれ，捕食者の山は被食者の山より遅れる．平衡点は $(c/d, a/b)$ であり，相平面では解は平衡点を囲む閉曲線になる
- 初期値を変えると周期も振幅も変わる．指数成長モデルのように定数倍になるわけではない
- 毛皮の取引数は個体数の観測量であり，比例という観測モデルの仮定を置いて初めて状態変数と結び付く．環境収容力，季節性，捕食の飽和，捕獲は，モデルに含まれていない要因である

## 課題

````{warning} 課題1：時系列と相平面の図とパラメタの説明

1. 演習1の3通りの初期値について，時系列を上段，相平面を下段に並べた図を作成し，`reports/figures/`に保存する．
2. 4つのパラメタ $a, b, c, d$ について，それぞれ「どの仮定に対応するか」「単位は何か」「2倍にすると平衡点と周期がどう変わるか」を表にまとめる．周期の変化は演習2の結果を根拠にする．
````

````{warning} 課題2：モデルに不足している要因

毛皮データとモデルの当てはめの図を見て，次を200字程度で書く．

モデルが再現できた性質を2つ，再現できなかった性質を2つ挙げる．
再現できなかった性質について，それぞれ「モデルに入っていない生態系の要因」と「観測モデルの仮定の問題」のどちらが原因と考えられるかを述べる．

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

第11回では，状態変数を3つに増やし，感染症のSIRモデルを扱う．
人口を感受性者 $S$，感染者 $I$，回復者 $R$ の3つの集団に分け，集団間の移動を式にする．
感染の項 $\beta SI/N$ は，今回の $xy$ と同じ「出会いの回数に比例する」という仮定から出てくる．
また，$S + I + R$ が一定という保存則が成り立つことを，数値解で確かめる．
今回の`x, y = state`という書き方を，`S, I, R = state`に広げるだけで実装できる．

## 自分の言葉で説明する問い

1. 状態変数が1つのモデルと2つのモデルで，`solve_ivp`の使い方はどこが変わり，どこが変わらないか．
2. Lotka–Volterraモデルの4つの項は，それぞれどのような仮定を表しているか．積 $xy$ が出てくる理由を説明せよ．
3. 捕食者の山が被食者の山より遅れるのはなぜか．データを見て入れた仮定ではないことを含めて説明せよ．
4. 毛皮の取引数を個体数の代わりに使うとき，どのような仮定を置いているか．その仮定が崩れる状況を1つ挙げよ．
